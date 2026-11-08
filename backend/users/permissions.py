from rest_framework.permissions import BasePermission


class RoleScopedPermission(BasePermission):
    """
    Default-deny, per-action role permission check for ViewSets.

    Subclasses set `action_roles`, e.g.:

        action_roles = {
            "list": {Role.DEPENDENCIA, Role.RESIDENTE},
            "create": {Role.DEPENDENCIA},
        }

    Any action not present in the map (including update/partial_update/destroy
    if the subclass forgot them) is denied, not silently allowed — this is
    the inverse of the reference project's bug where unmapped actions fell
    through to "any authenticated user".
    """

    action_roles: dict[str, set[str]] = {}

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        action = getattr(view, "action", None)
        allowed_roles = self.action_roles.get(action)
        if not allowed_roles:
            return False
        return user.role in allowed_roles


class AssignmentScopedQuerySetMixin:
    """
    Scopes a ViewSet's queryset to rows the requesting user is actually
    assigned to, instead of exposing every row to every authenticated role.

    Subclasses set:
      - `unrestricted_roles`: roles that see the full queryset (e.g. Dependencia).
      - `assignment_lookups`: {role: queryset_filter_kwarg} reaching the
        User through whatever FK chain applies for that role on this model,
        e.g. {"residente": "residente__user", "supervision": "supervisor__user"}.

    A role with no entry in either collection gets an empty queryset rather
    than the unfiltered one — same default-deny stance as RoleScopedPermission.
    """

    unrestricted_roles: set[str] = set()
    assignment_lookups: dict[str, str] = {}

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role in self.unrestricted_roles:
            return qs
        lookup = self.assignment_lookups.get(user.role)
        if lookup is None:
            return qs.none()
        return qs.filter(**{lookup: user})
