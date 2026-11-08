from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("bitacora", "0003_notabitacora_cierre")]

    operations = [migrations.DeleteModel(name="AdjuntoBitacora")]