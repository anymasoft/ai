from db.models import Lead
import csv
from io import StringIO

def export_leads_to_csv(leads: list[Lead]) -> str:
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Domain', 'Email', 'Phone', 'Source Page', 'Job ID', 'Created At'])
    for lead in leads:
        writer.writerow([
            lead.id, lead.domain, lead.email or '', lead.phone or '',
            lead.source_page or '', lead.job_id, lead.created_at.isoformat()
        ])
    return output.getvalue()
