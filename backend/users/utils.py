from django.utils.text import slugify


def generate_unique_username(email: str) -> str:
    """
    Derives a unique User.username from an email's local part. Needed because
    AbstractUser.username stays unique even though login is by email
    (USERNAME_FIELD), and auto-provisioned accounts have no username of their own.
    """
    from .models import User

    base = slugify(email.split("@")[0]) or "usuario"
    username = base
    suffix = 1
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f"{base}{suffix}"
    return username
