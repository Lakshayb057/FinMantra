import sys
import json
import re
import math
from datetime import datetime, date
import pandas as pd

def parse_any_date(val):
    if val is None or pd.isna(val):
        return None, None

    if isinstance(val, (datetime, pd.Timestamp)):
        age = calculate_age(val.date())
        return val.strftime('%Y-%m-%d'), age

    if isinstance(val, date):
        age = calculate_age(val)
        return val.strftime('%Y-%m-%d'), age

    # Handle numeric Excel serial date
    if isinstance(val, (int, float)):
        try:
            # Excel epoch offset ~25569
            dt = pd.to_datetime(val, unit='D', origin='1899-12-30')
            age = calculate_age(dt.date())
            return dt.strftime('%Y-%m-%d'), age
        except Exception:
            return None, -1

    val_str = str(val).strip()
    if not val_str or val_str.lower() == 'nan':
        return None, None

    # Try YYYY-MM-DD
    if re.match(r'^\d{4}-\d{1,2}-\d{1,2}$', val_str):
        try:
            parts = [int(p) for p in val_str.split('-')]
            dt = date(parts[0], parts[1], parts[2])
            return dt.strftime('%Y-%m-%d'), calculate_age(dt)
        except Exception:
            return None, -1

    # Try DD-MM-YYYY or DD/MM/YYYY
    if re.match(r'^\d{1,2}[-/]\d{1,2}[-/]\d{4}$', val_str):
        try:
            parts = [int(p) for p in re.split(r'[-/]', val_str)]
            dt = date(parts[2], parts[1], parts[0])
            return dt.strftime('%Y-%m-%d'), calculate_age(dt)
        except Exception:
            return None, -1

    # Fallback to pandas to_datetime
    try:
        dt = pd.to_datetime(val_str, errors='coerce')
        if pd.notna(dt):
            return dt.strftime('%Y-%m-%d'), calculate_age(dt.date())
    except Exception:
        pass

    return None, -1

def calculate_age(birth_date):
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age

def parse_url_query_params(url_str):
    params = {}
    if not url_str or not isinstance(url_str, str):
        return params
    
    url_str = url_str.strip()
    if '?' in url_str:
        query = url_str.split('?', 1)[1]
        pairs = query.split('&')
        for pair in pairs:
            if '=' in pair:
                k, v = pair.split('=', 1)
                params[k.strip().lower()] = v.strip()
    return params

def process_lead_file(file_path, agent_map, card_map, user_role='admin', user_id=None, existing_app_ids=None):
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path, dtype=str, keep_default_na=False)
        else:
            df = pd.read_excel(file_path, dtype=str, keep_default_na=False)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to read Excel/CSV file with pandas: {str(e)}"
        }

    if df.empty:
        return {
            "success": False,
            "error": "Uploaded Excel/CSV file contains no data rows."
        }

    total_rows = len(df)
    valid_leads = []
    errors = []
    created_count = 0
    failed_count = 0

    existing_set = set([str(x).lower().strip() for x in (existing_app_ids or []) if x])
    seen_file_app_ids = set()

    for idx, row in df.iterrows():
        row_num = idx + 2  # Excel 1-indexed row number excluding header
        
        # Helper to extract column with fallback headers
        def get_col(*keys):
            for k in keys:
                # Match column name case-insensitively
                for col in df.columns:
                    if col.strip().lower() == k.strip().lower():
                        val = str(row[col]).strip()
                        if val and val.lower() != 'nan' and val.lower() != 'none':
                            return val
            return ''

        full_name = get_col('Full Name', 'full_name', 'Name', 'name')
        raw_phone = get_col('Phone', 'phone', 'Mobile', 'mobile')
        clean_phone = re.sub(r'\D', '', raw_phone)
        email = get_col('Email', 'email')
        agent_identifier = get_col('Agent ID', 'agent_id', 'AgentsId', 'Source Agent', 'Agent')
        app_id = get_col('Application ID', 'application_id', 'App ID')

        # 1. Full Name Validation (Mandatory)
        if not full_name:
            failed_count += 1
            errors.append(f"Row {row_num}: Full Name is mandatory.")
            continue
        
        if not re.match(r'^[a-zA-Z\s]+$', full_name):
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Name must contain alphabetic characters only as per PAN card.")
            continue

        name_words = [w for w in full_name.split() if w]
        if len(name_words) < 2:
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Please enter complete Name (First Name + Last Name).")
            continue

        # 2. Phone Validation (Mandatory)
        if not clean_phone:
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Phone number is mandatory.")
            continue

        if not re.match(r'^[6-9]', clean_phone):
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Mobile number must start with 6, 7, 8, or 9.")
            continue

        if len(clean_phone) != 10:
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Mobile number must be exactly 10 digits.")
            continue

        # 3. Email Validation (Mandatory)
        if not email:
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Email address is mandatory.")
            continue

        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Invalid email format ('{email}').")
            continue

        # 4. Unique Application ID Constraint
        if app_id:
            clean_app_id = app_id.lower().strip()
            if clean_app_id in existing_set or clean_app_id in seen_file_app_ids:
                failed_count += 1
                errors.append(f"Row {row_num} ({full_name}): Application ID '{app_id}' already exists in database or upload file. Duplicate rejected.")
                continue
            seen_file_app_ids.add(clean_app_id)

        # 5. PAN Card Validation (Optional)
        pan_no = get_col('PAN Number', 'pan_no', 'PAN').upper()
        if pan_no and not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$', pan_no):
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Invalid PAN card format ('{pan_no}'). Must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).")
            continue

        # 6. Date of Birth & Age Validation (Optional)
        raw_dob = row.get('Date of Birth') or row.get('dob') or row.get('DOB') or ''
        formatted_dob, applicant_age = parse_any_date(raw_dob)

        if raw_dob and str(raw_dob).strip() and str(raw_dob).strip().lower() != 'nan':
            if applicant_age == -1 or not formatted_dob:
                failed_count += 1
                errors.append(f"Row {row_num} ({full_name}): Invalid Date of Birth ('{raw_dob}'). Use YYYY-MM-DD or DD-MM-YYYY.")
                continue
            if applicant_age < 21 or applicant_age > 70:
                failed_count += 1
                errors.append(f"Row {row_num} ({full_name}): Applicant age ({applicant_age} yrs) must be between 21 and 70 years old.")
                continue

        # 7. Pincode Validation (Optional)
        pincode = get_col('Pincode', 'pincode')
        if pincode and not re.match(r'^\d{6}$', pincode):
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Pincode must be exactly 6 numeric digits ('{pincode}').")
            continue

        # 8. Monthly Income Validation (Optional)
        raw_income = re.sub(r'\D', '', get_col('Net Monthly Income', 'monthly_income'))
        if raw_income:
            inc_num = int(raw_income)
            if inc_num < 25000 or inc_num > 1000000:
                failed_count += 1
                errors.append(f"Row {row_num} ({full_name}): Monthly income (₹{inc_num}) must be between ₹25,000 and ₹10,00,000 for credit card eligibility.")
                continue

        # 9. Agent ID Verification (Strictly Agent Code / ID, NOT Phone Number)
        if agent_identifier and re.match(r'^[6-9]\d{9}$', agent_identifier) and agent_identifier.lower() not in agent_map:
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): '{agent_identifier}' is a Phone Number. Please specify a valid Agent Code / ID (e.g. ag_01, lakshay) instead.")
            continue

        matched_agent = None
        if agent_identifier:
            clean_id = agent_identifier.lower().strip()
            clean_alnum = re.sub(r'[^a-z0-9]', '', clean_id)
            matched_agent = agent_map.get(clean_id) or agent_map.get(clean_alnum)

        if not matched_agent and user_role == 'agent' and user_id:
            clean_user_id = user_id.lower().strip()
            clean_user_alnum = re.sub(r'[^a-z0-9]', '', clean_user_id)
            matched_agent = agent_map.get(clean_user_id) or agent_map.get(clean_user_alnum)

        if not matched_agent and user_role == 'agent' and user_id:
            matched_agent = {
                "id": user_id,
                "name": "Field Agent",
                "locations": ["Head Office"]
            }

        if not matched_agent:
            failed_count += 1
            errors.append(f"Row {row_num} ({full_name}): Source Agent Code / ID '{agent_identifier or 'Unspecified'}' does NOT exist in database. Rejected.")
            continue

        # 10. Card Name Alignment against DB
        raw_card_name = get_col('Card Name', 'card_name', 'Card')
        matched_card = card_map.get(raw_card_name.lower()) if raw_card_name else None

        card_id = matched_card.get('id') if matched_card else None
        final_card_name = matched_card.get('name') if matched_card else raw_card_name
        final_card_bank = matched_card.get('bank') if matched_card else get_col('Card Bank', 'card_bank')
        final_redirect_url = (matched_card.get('redirect_url') or matched_card.get('apply_url')) if matched_card else get_col('Redirect URL', 'redirect_url')

        # 11. Complete 30-Parameter Tracking Extraction & URL Parsing
        utm_channel = get_col('UTM Channel', 'utm_channel')
        utm_medium = get_col('UTM Medium', 'utm_medium')
        utm_source = get_col('UTM Source', 'utm_source')
        utm_category = get_col('UTM Category', 'utm_category')
        utm_campaign = get_col('UTM Campaign', 'utm_campaign')
        utm_term = get_col('UTM Term', 'utm_term')
        utm_content = get_col('UTM Content', 'utm_content')
        utm_creative_format = get_col('UTM Creative Format', 'utm_creative_format')
        utm_info = get_col('UTM Info', 'utm_info')
        utm_id = get_col('UTM Campaign ID (utm_id)', 'UTM Campaign ID', 'utm_id')
        utm_creative = get_col('UTM Ad ID (utm_creative)', 'UTM Ad ID', 'utm_creative', 'ad_id')
        utm_internal = get_col('UTM Internal', 'utm_internal')
        utm_keyword = get_col('UTM Keyword (utm_keyword)', 'UTM Keyword', 'utm_keyword')
        utm_matchtype = get_col('UTM Matchtype (utm_matchtype)', 'UTM Matchtype', 'utm_matchtype')
        utm_network = get_col('UTM Network (utm_network)', 'UTM Network', 'utm_network')
        utm_placement = get_col('UTM Placement (utm_placement)', 'UTM Placement', 'utm_placement')
        utm_device = get_col('UTM Device (utm_device)', 'UTM Device', 'utm_device')
        utm_location = get_col('UTM Location (utm_location)', 'UTM Location', 'utm_location')

        landing_page = get_col('Landing Page URL', 'landing_page', 'Landing Page')
        redirect_url = get_col('Redirect URL', 'redirect_url') or final_redirect_url
        referrer = get_col('Referrer Source', 'referrer', 'Referrer')

        fbclid = get_col('FBCLID (Facebook)', 'FBCLID', 'fbclid')
        gclid = get_col('GCLID (Google)', 'GCLID', 'gclid')
        gbraid = get_col('GBRAID (Google App iOS)', 'GBRAID', 'gbraid')
        wbraid = get_col('WBRAID (Google App Web)', 'WBRAID', 'wbraid')
        gclsrc = get_col('GCLSRC (Google Click Source)', 'GCLSRC', 'gclsrc')
        dclid = get_col('DCLID (Google Display)', 'DCLID', 'dclid')
        msclkid = get_col('MSCLKID (Bing)', 'MSCLKID', 'msclkid')
        ttclid = get_col('TTCLID (TikTok)', 'TTCLID', 'ttclid')
        twclid = get_col('TWCLID (Twitter)', 'TWCLID', 'twclid')
        li_fat_id = get_col('LI_FAT_ID (LinkedIn)', 'LI_FAT_ID', 'li_fat_id')

        # Auto-parse URL Query parameters
        for target_url in [landing_page, redirect_url]:
            url_params = parse_url_query_params(target_url)
            if url_params:
                if not utm_source and 'utm_source' in url_params: utm_source = url_params['utm_source']
                if not utm_medium and 'utm_medium' in url_params: utm_medium = url_params['utm_medium']
                if not utm_campaign and 'utm_campaign' in url_params: utm_campaign = url_params['utm_campaign']
                if not utm_term and 'utm_term' in url_params: utm_term = url_params['utm_term']
                if not utm_content and 'utm_content' in url_params: utm_content = url_params['utm_content']
                if not utm_creative and ('utm_creative' in url_params or 'ad_id' in url_params): utm_creative = url_params.get('utm_creative') or url_params.get('ad_id')
                if not utm_id and 'utm_id' in url_params: utm_id = url_params['utm_id']
                if not utm_placement and 'utm_placement' in url_params: utm_placement = url_params['utm_placement']
                if not utm_internal and 'utm_internal' in url_params: utm_internal = url_params['utm_internal']
                if not utm_info and 'utm_info' in url_params: utm_info = url_params['utm_info']
                if not fbclid and 'fbclid' in url_params: fbclid = url_params['fbclid']
                if not gclid and 'gclid' in url_params: gclid = url_params['gclid']

        # Defaults
        if not utm_source: utm_source = 'meta' if fbclid else ('google' if gclid else 'excel_upload')
        if not utm_medium: utm_medium = 'paid_social' if fbclid else ('cpc' if gclid else 'agent_portal')
        if not utm_info: utm_info = utm_medium or 'agent_portal'
        if not utm_channel: utm_channel = 'paid_social' if utm_medium == 'paid_social' else (utm_medium or 'N/A')

        agent_loc = matched_agent.get('locations', ['Head Office'])
        city_val = agent_loc[0] if isinstance(agent_loc, list) and len(agent_loc) > 0 else 'Head Office'

        lead_obj = {
            "full_name": full_name,
            "phone": clean_phone,
            "email": email or None,
            "pan_no": pan_no or None,
            "dob": formatted_dob or None,
            "mother_name": get_col('Mother Name', 'mother_name') or None,
            "current_address": get_col('Current Address', 'current_address', 'Address') or None,
            "pincode": pincode or None,
            "employment": get_col('Employment', 'employment') or 'Salaried',
            "designation": get_col('Designation', 'designation') or None,
            "company_name": get_col('Company Name', 'company_name', 'Company') or None,
            "has_credit_card": get_col('Already Has Credit Card', 'has_credit_card') or 'No',
            "monthly_income": raw_income or None,
            "income_range": get_col('Income Range', 'income_range') or '3-6 LPA',
            "city": city_val,
            "agent_id": matched_agent.get('id'),
            "agent_name": matched_agent.get('name'),
            "agent_location": city_val,
            "card_id": card_id,
            "card_name": final_card_name,
            "card_bank": final_card_bank,
            "source": 'agent',
            "consent": get_col('Consent', 'consent').lower() != 'no',
            "redirect_url": redirect_url or None,
            "application_id": app_id or None,
            "utm_channel": utm_channel or None,
            "utm_medium": utm_medium or None,
            "utm_source": utm_source or None,
            "utm_category": utm_category or None,
            "utm_campaign": utm_campaign or None,
            "utm_term": utm_term or None,
            "utm_content": utm_content or None,
            "utm_creative_format": utm_creative_format or None,
            "utm_info": utm_info or None,
            "utm_id": utm_id or None,
            "utm_creative": utm_creative or None,
            "utm_internal": utm_internal or None,
            "utm_keyword": utm_keyword or None,
            "utm_matchtype": utm_matchtype or None,
            "utm_network": utm_network or None,
            "utm_placement": utm_placement or None,
            "utm_device": utm_device or None,
            "utm_location": utm_location or None,
            "landing_page": landing_page or None,
            "referrer": referrer or None,
            "fbclid": fbclid or None,
            "gclid": gclid or None,
            "gbraid": gbraid or None,
            "wbraid": wbraid or None,
            "gclsrc": gclsrc or None,
            "dclid": dclid or None,
            "msclkid": msclkid or None,
            "ttclid": ttclid or None,
            "twclid": twclid or None,
            "li_fat_id": li_fat_id or None,
            "utm_params": {
                "utm_source": utm_source,
                "utm_medium": utm_medium,
                "utm_campaign": utm_campaign,
                "utm_term": utm_term,
                "utm_content": utm_content,
                "utm_channel": utm_channel,
                "utm_category": utm_category,
                "utm_info": utm_info,
                "utm_creative_format": utm_creative_format,
                "utm_id": utm_id,
                "utm_creative": utm_creative,
                "utm_internal": utm_internal,
                "utm_keyword": utm_keyword,
                "utm_matchtype": utm_matchtype,
                "utm_network": utm_network,
                "utm_placement": utm_placement,
                "utm_device": utm_device,
                "utm_location": utm_location,
                "landing_page": landing_page,
                "redirect_url": redirect_url,
                "referrer": referrer,
                "fbclid": fbclid,
                "gclid": gclid,
                "gbraid": gbraid,
                "wbraid": wbraid,
                "gclsrc": gclsrc,
                "dclid": dclid,
                "msclkid": msclkid,
                "ttclid": ttclid,
                "twclid": twclid,
                "li_fat_id": li_fat_id
            }
        }
        valid_leads.append(lead_obj)
        created_count += 1

    return {
        "success": True,
        "total": total_rows,
        "created": created_count,
        "failed": failed_count,
        "errors": errors,
        "valid_leads": valid_leads
    }

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Insufficient arguments for python excel_parser"}))
        sys.exit(1)

    file_path_arg = sys.argv[1]
    agent_map_json = sys.argv[2]
    card_map_json = sys.argv[3]
    user_role_arg = sys.argv[4] if len(sys.argv) > 4 else 'admin'
    user_id_arg = sys.argv[5] if len(sys.argv) > 5 else None
    existing_app_ids_json = sys.argv[6] if len(sys.argv) > 6 else '[]'

    try:
        agent_map_data = json.loads(agent_map_json)
        card_map_data = json.loads(card_map_json)
        existing_app_ids_data = json.loads(existing_app_ids_json)
        result = process_lead_file(file_path_arg, agent_map_data, card_map_data, user_role_arg, user_id_arg, existing_app_ids_data)
        print(json.dumps(result))
    except Exception as err:
        print(json.dumps({"success": False, "error": f"Python parser execution error: {str(err)}"}))
