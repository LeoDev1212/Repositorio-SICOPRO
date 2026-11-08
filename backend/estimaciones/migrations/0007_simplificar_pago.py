from django.db import migrations, models


def conservar_estado_pagado(apps, schema_editor):
    Estimacion = apps.get_model("estimaciones", "Estimacion")
    OrdenPago = apps.get_model("estimaciones", "OrdenPago")
    estimaciones_pagadas = OrdenPago.objects.filter(estado="dispersada").values_list(
        "estimacion_id", flat=True
    )
    Estimacion.objects.filter(pk__in=estimaciones_pagadas).update(pagada=True)
    Estimacion.objects.filter(status="orden_pago_emitida").update(status="firmada")


class Migration(migrations.Migration):
    dependencies = [("estimaciones", "0006_estimacion_porcentaje_cinco_al_millar")]

    operations = [
        migrations.AddField(
            model_name="estimacion",
            name="pagada",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(conservar_estado_pagado, migrations.RunPython.noop),
        migrations.RemoveField(model_name="estimacion", name="fecha_orden_pago"),
        migrations.DeleteModel(name="OrdenPago"),
        migrations.AlterField(
            model_name="estimacion",
            name="status",
            field=models.CharField(
                choices=[
                    ("borrador", "Borrador"),
                    ("en_revision_residente", "En revisión (Residente)"),
                    ("rechazada_residente", "Rechazada por Residente"),
                    ("aprobada_residente", "Aprobada por Residente"),
                    ("pendiente_firma", "Pendiente de firma"),
                    ("firmada", "Firmada"),
                ],
                default="borrador",
                max_length=25,
            ),
        ),
        migrations.AlterField(
            model_name="estimacionevento",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("presentada", "Presentada"),
                    ("aprobada_residente", "Aprobada por Residente"),
                    ("rechazada_residente", "Rechazada por Residente"),
                    ("firmada", "Firmada"),
                ],
                max_length=25,
            ),
        ),
    ]