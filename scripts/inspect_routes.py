import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app
from app.api import deps
from fastapi.routing import APIRoute

def extract_routes(router_or_app, base_prefix=""):
    all_routes = []
    routes_list = getattr(router_or_app, "routes", [])
    for r in routes_list:
        if hasattr(r, "original_router"):
            prefix = base_prefix
            if hasattr(r, "include_context") and r.include_context:
                prefix = prefix + (r.include_context.prefix or "")
            all_routes.extend(extract_routes(r.original_router, prefix))
        elif hasattr(r, "routes"):
            prefix = base_prefix + getattr(r, "prefix", "")
            all_routes.extend(extract_routes(r, prefix))
        elif isinstance(r, APIRoute):
            all_routes.append((base_prefix, r))
        elif hasattr(r, "endpoint"):
            if r.path not in ("/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect", "/api/v1/openapi.json"):
                all_routes.append((base_prefix, r))
    return all_routes

print("=== FASTAPI ROUTE AUDIT ===")
routes = extract_routes(app)
print(f"Total Application Route instances: {len(routes)}")

public_count = 0
protected_count = 0

for base_prefix, r in routes:
    methods = ",".join(sorted(r.methods)) if hasattr(r, "methods") else "GET"
    path = r.path
    if not path.startswith(base_prefix) and base_prefix:
        path = base_prefix + path
    endpoint_func = r.endpoint
    
    all_deps = list(getattr(r, "dependencies", []))
    import inspect
    sig = inspect.signature(endpoint_func)
    params = sig.parameters
    
    auth_deps = []
    is_protected = False
    is_tenant_bound = False
    rbac = None
    
    for p_name, param in params.items():
        default = param.default
        if hasattr(default, "dependency"):
            dep = default.dependency
            dep_name = getattr(dep, "__name__", str(dep))
            if dep in (deps.get_current_user, deps.get_current_active_business):
                is_protected = True
                auth_deps.append(dep_name)
            if dep == deps.get_current_active_business:
                is_tenant_bound = True
            if "require_role" in str(dep) or "_role_checker" in str(dep_name):
                is_protected = True
                is_tenant_bound = True
                if hasattr(dep, "__closure__") and dep.__closure__:
                    for cell in dep.__closure__:
                        if isinstance(cell.cell_contents, list):
                            rbac = cell.cell_contents
                auth_deps.append(f"require_role({rbac})")

    for d in all_deps:
        dep = d.dependency
        dep_name = getattr(dep, "__name__", str(dep))
        if dep in (deps.get_current_user, deps.get_current_active_business):
            is_protected = True
            auth_deps.append(dep_name)
        if dep == deps.get_current_active_business:
            is_tenant_bound = True

    if is_protected:
        protected_count += 1
        status = "PROTECTED"
    else:
        public_count += 1
        status = "PUBLIC"

    print(f"{methods:6} | {path:42} | {status:9} | TenantBound: {str(is_tenant_bound):5} | RBAC: {str(rbac):15} | Deps: {', '.join(auth_deps)}")

print(f"\nSummary:")
print(f"Total application API routes: {len(routes)}")
print(f"Public routes: {public_count}")
print(f"Protected routes: {protected_count}")

