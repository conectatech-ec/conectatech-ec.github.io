"""593 report identity. Reception time and the Drive filename are not the cut date."""
import re
from datetime import datetime, timedelta, timezone

LOCAL = timezone(timedelta(hours=-5))
NAME = re.compile(r'Reporte-Inventario(?: (?:al )?(\d{2}-\d{2}-\d{4}))?\.xlsx\Z')


def report_name(name):
    match = NAME.fullmatch(name)
    if not match:
        raise ValueError('REPORT_FILENAME')
    if not match[1]:
        return None
    try:
        return datetime.strptime(match[1], '%d-%m-%Y').date()
    except ValueError:
        raise ValueError('REPORT_FILENAME_DATE') from None


def timestamp(value):
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if result.tzinfo is None:
            raise ValueError()
        return result
    except (AttributeError, TypeError, ValueError):
        raise ValueError('REPORT_TIMESTAMP_REQUIRED') from None


def confirm_cut(name, created, modified, heading_dates=()):
    """Keep the existing 593 core timestamp policy; require corroboration when undated.

    Real 593 sample: one INVENTARIO sheet, fixed row-4 schema, created == modified.
    A copied/edited workbook or ambiguous/missing date is held for review. Nothing
    falls back to today's date, upload time, Drive modifiedTime, or ZIP timestamps.
    The caller must first verify the complete inventory schema.
    """
    named = report_name(name)
    generated = timestamp(created)
    cut = generated.astimezone(LOCAL).date()
    headings = set(heading_dates)
    if len(headings) > 1 or headings and headings != {cut}:
        raise ValueError('REPORT_DATE_MISMATCH')
    if named and named != cut:
        raise ValueError('REPORT_DATE_MISMATCH')
    if modified is not None and timestamp(modified) != generated:
        raise ValueError('REPORT_CUT_DATE_UNCONFIRMED')
    if not named and not headings and modified is None:
        raise ValueError('REPORT_CUT_DATE_UNCONFIRMED')
    evidence = ('report_heading_and_export_timestamp' if headings else
                '593_matching_created_modified' if modified is not None else
                'legacy_filename_and_export_timestamp')
    return generated, cut.isoformat(), evidence
