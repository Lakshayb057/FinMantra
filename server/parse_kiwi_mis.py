import sys
import json
import re
import os

# Status ranking dictionary
# Rank 1 = NOT_STARTED (Lowest Rank)
# Rank 13 = AC_CREATED (Highest Winning Rank)
# Higher rank number = Better status. Winner = bank with HIGHEST rank number.
STATUS_RANKING = {
    'NOT_STARTED': 1,
    'NOT_APPLICABLE': 2,
    'REJECTED': 3,
    'IN_PROGRESS': 4,
    'DOC_UPLOAD_PENDING': 5,
    'DOC_UPLOADED': 6,
    'KYC_PENDING': 7,
    'DOC_REUPLOAD_REQUIRED': 8,
    'KYC_DONE': 9,
    'SUBMITTED': 10,
    'SUBMITTED_OTP_VERIFIED': 11,
    'VKYC_PENDING': 12,
    'AC_CREATED': 13
}

def clean_user_id(val):
    if val is None:
        return ''
    s = str(val).strip()
    if s.endswith('.0'):
        s = s[:-2]
    return re.sub(r'[^a-z0-9]', '', s.lower())

def get_status_rank(status_str):
    if not status_str:
        return 0
    s = str(status_str).strip().upper()
    clean = re.sub(r'[^A-Z0-9]', '', s)

    if 'ACCREATED' in clean or 'ACCOUNTCREATED' in clean:
        return 13
    if 'VKYCPENDING' in clean or 'VKYC' in clean:
        return 12
    if 'OTPVERIFIED' in clean or 'SUBMITTEDOTP' in clean:
        return 11
    if 'SUBMITTED' in clean:
        return 10
    if 'KYCDONE' in clean or 'KYCCOMPLETED' in clean:
        return 9
    if 'DOCREUPLOAD' in clean or 'REUPLOAD' in clean:
        return 8
    if 'KYCPENDING' in clean:
        return 7
    if 'DOCUPLOADED' in clean or 'DOCUMENTUPLOADED' in clean:
        return 6
    if 'DOCUPLOADPENDING' in clean or 'DOCPENDING' in clean or 'DOCUMENTPENDING' in clean:
        return 5
    if 'INPROGRESS' in clean or 'PROCESSING' in clean:
        return 4
    if 'REJECT' in clean or 'DECLINE' in clean or 'CANCEL' in clean:
        return 3
    if 'NOTAPPLICABLE' in clean or 'NA' in clean:
        return 2
    if 'NOTSTARTED' in clean:
        return 1

    clean_u = re.sub(r'[\s-]+', '_', s)
    return STATUS_RANKING.get(clean_u, 0)

def extract_urn(val):
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    m = re.search(r'FM\d{4}[A-Z]\d{7}', s, re.IGNORECASE) or \
        re.search(r'FM\d{4}\d{6,12}', s, re.IGNORECASE) or \
        re.search(r'FM[0-9A-Z]{8,18}', s, re.IGNORECASE)
    return m.group(0).upper() if m else None

def parse_xlsx_fast(file_path):
    try:
        import openpyxl
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        sheet_names = wb.sheetnames
        
        def read_sheet_rows(sheet_name):
            if sheet_name not in sheet_names:
                return []
            ws = wb[sheet_name]
            rows_iter = ws.iter_rows(values_only=True)
            try:
                headers_raw = next(rows_iter)
            except StopIteration:
                return []
            if headers_raw and any(headers_raw):
                headers = [str(h).strip() if h is not None else f'col_{idx}' for idx, h in enumerate(headers_raw)]
            else:
                return []
            
            result = []
            for r in rows_iter:
                if not r or not any(r):
                    continue
                row_dict = {}
                for idx, val in enumerate(r):
                    if idx < len(headers):
                        row_dict[headers[idx]] = '' if val is None else str(val).strip()
                result.append(row_dict)
            return result

        yes_name = next((s for s in sheet_names if 'yes' in s.lower()), None)
        au_name = next((s for s in sheet_names if 'au' in s.lower()), None)
        pnb_name = next((s for s in sheet_names if 'pnb' in s.lower()), None)

        if not yes_name:
            return {"error": "YES KIWI sheet not found in uploaded Excel file."}

        yes_rows = read_sheet_rows(yes_name)
        au_rows = read_sheet_rows(au_name) if au_name else []
        pnb_rows = read_sheet_rows(pnb_name) if pnb_name else []

        wb.close()
        return process_kiwi_rows(yes_rows, au_rows, pnb_rows)

    except Exception as e:
        return {"error": f"Failed to parse Excel file: {str(e)}"}

def find_key(sample_row, target_type):
    if not sample_row:
        return None
    keys = list(sample_row.keys())
    if target_type == 'state':
        for k in keys:
            c = re.sub(r'[^a-z]', '', k.lower())
            if c in ('currentstate', 'currentstatus', 'appstate', 'appstatus'):
                return k
        for k in keys:
            c = k.lower()
            if 'current' in c and ('state' in c or 'status' in c):
                return k
        for k in keys:
            c = re.sub(r'[^a-z]', '', k.lower())
            if c in ('status', 'misstatus', 'finalstatus'):
                return k
        for k in keys:
            c = k.lower().strip()
            if c not in ('state', 'customer_state') and ('state' in c or 'status' in c):
                return k
        return 'current_state'

    elif target_type == 'user_id':
        for k in keys:
            c = re.sub(r'[^a-z]', '', k.lower())
            if c in ('userid', 'useridentifier'):
                return k
        for k in keys:
            if 'user' in re.sub(r'[^a-z]', '', k.lower()):
                return k
        return 'user_id'

    elif target_type == 'content':
        for k in keys:
            c = re.sub(r'[^a-z]', '', k.lower())
            if c in ('content', 'contant', 'urn', 'reference'):
                return k
        for k, v in sample_row.items():
            if 'FM' in str(v).upper():
                return k
        return 'content'

    return None

def process_kiwi_rows(yes_rows, au_rows, pnb_rows):
    if not yes_rows:
        return {"parsedRows": []}

    yes_sample = yes_rows[0]
    yes_content_key = find_key(yes_sample, 'content')
    yes_user_id_key = find_key(yes_sample, 'user_id')
    yes_state_key = find_key(yes_sample, 'state')

    # Index AU rows by user_id
    au_user_map = {}
    if au_rows:
        au_uid_key = find_key(au_rows[0], 'user_id')
        au_state_key = find_key(au_rows[0], 'state')
        for r in au_rows:
            raw_uid = r.get(au_uid_key) or r.get('user_id') or ''
            uid = clean_user_id(raw_uid)
            if uid:
                st = r.get(au_state_key) or r.get('current_state') or r.get('status') or ''
                r['_state'] = str(st).strip()
                au_user_map[uid] = r

    # Index PNB rows by user_id
    pnb_user_map = {}
    if pnb_rows:
        pnb_uid_key = find_key(pnb_rows[0], 'user_id')
        pnb_state_key = find_key(pnb_rows[0], 'state')
        for r in pnb_rows:
            raw_uid = r.get(pnb_uid_key) or r.get('user_id') or ''
            uid = clean_user_id(raw_uid)
            if uid:
                st = r.get(pnb_state_key) or r.get('current_state') or r.get('status') or ''
                r['_state'] = str(st).strip()
                pnb_user_map[uid] = r

    parsed_rows = []
    skipped_count = 0

    for yes_row in yes_rows:
        raw_content = yes_row.get(yes_content_key) or yes_row.get('content') or ''
        extracted_urn = extract_urn(raw_content)

        if not extracted_urn:
            skipped_count += 1
            continue

        raw_uid = yes_row.get(yes_user_id_key) or yes_row.get('user_id') or ''
        uid = clean_user_id(raw_uid)

        cand_au = au_user_map.get(uid) if uid else None
        cand_pnb = pnb_user_map.get(uid) if uid else None

        yes_state = str(yes_row.get(yes_state_key) or yes_row.get('current_state') or '').strip()
        au_state = str(cand_au.get('_state') or cand_au.get('current_state') or '') if cand_au else ''
        pnb_state = str(cand_pnb.get('_state') or cand_pnb.get('current_state') or '') if cand_pnb else ''

        yes_rank = get_status_rank(yes_state)
        au_rank = get_status_rank(au_state)
        pnb_rank = get_status_rank(pnb_state)

        # Higher rank number = better status (13 is best: AC_CREATED, 1 is worst: NOT_STARTED)
        winning_bank = 'YES'
        winning_row = yes_row
        winning_state = yes_state
        best_rank = yes_rank

        if au_rank > best_rank:
            best_rank = au_rank
            winning_bank = 'AU'
            winning_row = cand_au
            winning_state = au_state

        if pnb_rank > best_rank:
            best_rank = pnb_rank
            winning_bank = 'PNB'
            winning_row = cand_pnb
            winning_state = pnb_state

        wr = winning_row or {}
        parsed_rows.append({
            'content': extracted_urn,
            'registration': wr.get('registration') or wr.get('Registration') or '',
            'pan_submit': wr.get('Pan_Submit') or wr.get('pan_submit') or '',
            'form_fetch': wr.get('Form_Fetch') or wr.get('form_fetch') or '',
            'form_submit': wr.get('Form_Submit') or wr.get('form_submit') or '',
            'ipa': wr.get('IPA') or wr.get('ipa') or '',
            'card_created': wr.get('Card_Created') or wr.get('card_created') or '',
            'vkyc': wr.get('VKYC') or wr.get('vkyc') or '',
            'current_state': winning_state,
            'reject_reason': wr.get('reject_reason') or '',
            'application_id_bank_2': wr.get('application_id_bank_2') or '',
            'first_txn': wr.get('First_txn') or wr.get('first_txn') or '',
            'APPLICATION_REFERENCE_NUMBER': extracted_urn,
            'current_status': winning_state,
            'final_decision': winning_state,
            'kiwi_winning_bank': winning_bank,
            'kiwi_user_id': uid,
            'kiwi_yes_status': yes_state,
            'kiwi_au_status': au_state,
            'kiwi_pnb_status': pnb_state,
            '_extractedUrn': extracted_urn,
            'yes_rank': yes_rank,
            'au_rank': au_rank,
            'pnb_rank': pnb_rank,
            'status_rank': best_rank
        })

    return {
        "success": True,
        "parsedRows": parsed_rows,
        "totalRows": len(parsed_rows),
        "skippedRows": skipped_count
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided."}))
        sys.exit(1)
    file_path = sys.argv[1]
    res = parse_xlsx_fast(file_path)
    print(json.dumps(res))
