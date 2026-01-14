# python-ml/ocr/field_extractor.py
import re
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class PhilippineFieldExtractor:
    """Extracts fields from Philippine ID documents"""
    
    def __init__(self):
        # Philippine name patterns
        self.name_patterns = {
            'full_name': [
                r'(?:name|full name|pangalan)[:\s]+\s*([A-Z][A-Z\s.,-]+)',
                r'^([A-Z][A-Z\s.,-]{3,})$'
            ],
            'last_name': [
                r'(?:last name|surname|apelyido)[:\s]+\s*([A-Z][A-Z\s.,-]+)',
                r'(?:family name)[:\s]+\s*([A-Z][A-Z\s.,-]+)'
            ],
            'first_name': [
                r'(?:first name|given name|pangalan)[:\s]+\s*([A-Z][A-Z\s.,-]+)',
                r'(?:given names?)[:\s]+\s*([A-Z][A-Z\s.,-]+)'
            ],
            'middle_name': [
                r'(?:middle name|middle initial)[:\s]+\s*([A-Z][A-Z\s.,-]*)',
                r'(?:m\.?i\.?)[:\s]+\s*([A-Z][A-Z\s.,-]*)'
            ]
        }
        
        # Philippine ID number patterns
        self.id_patterns = [
            r'(?:id|i\.?d\.?|identification)[\s#:]+([A-Z0-9\-]+)',
            r'(?:no\.?|number)[\s:]+([A-Z0-9\-]+)',
            r'([A-Z]{1,2}\d{2}[-]\d{2}[-]\d{6})',  # PhilSys pattern
            r'(\d{4}[-]\d{4}[-]\d{4})',  # Common ID pattern
            r'([A-Z]{2}\d{7})',  # Driver's License
            r'([A-Z]{1}\d{7})'   # Passport
        ]
        
        # Address patterns (Philippine)
        self.address_patterns = [
            r'(?:address|tirahan|direccion)[:\s]+\s*([^\n\r]+)',
            r'(?:brgy|barangay)[.\s]+([A-Z][A-Za-z\s]+)',
            r'(?:municipality|munisipyo|city|lungsod)[:\s]+([A-Z][A-Za-z\s]+)',
            r'(?:province|probinsya)[:\s]+([A-Z][A-Za-z\s]+)'
        ]
        
        # Birth date patterns
        self.date_patterns = [
            r'(?:birth|birthday|kapanganakan)[:\s]+\s*([\d\/\-]+)',
            r'(?:date of birth|d\.o\.b\.)[:\s]+\s*([\d\/\-]+)',
            r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})'  # MM/DD/YYYY or DD/MM/YYYY
        ]

    def extract_fields(self, text: str, id_type: str = None) -> Dict:
        """Extract fields from OCR text"""
        text_upper = text.upper()
        fields = {}
        
        # Extract basic fields
        fields.update(self._extract_names(text_upper, id_type))
        fields.update(self._extract_id_number(text_upper))
        fields.update(self._extract_address(text_upper))
        fields.update(self._extract_birth_date(text_upper))
        
        # Format full name properly for Philippine IDs
        if not fields.get('full_name') and any(fields.get(k) for k in ['first_name', 'last_name']):
            fields['full_name'] = self._format_ph_name(
                fields.get('first_name', ''),
                fields.get('middle_name', ''),
                fields.get('last_name', ''),
                id_type
            )
        
        # Clean up fields
        fields = self._clean_fields(fields)
        
        logger.info(f"Extracted fields: {fields}")
        return fields
    
    def _extract_names(self, text: str, id_type: str = None) -> Dict:
        """Extract name fields from text"""
        names = {}
        
        # Try labeled fields first (PhilSys, Driver's License format)
        names['last_name'] = self._extract_pattern(text, self.name_patterns['last_name'])
        names['first_name'] = self._extract_pattern(text, self.name_patterns['first_name'])
        names['middle_name'] = self._extract_pattern(text, self.name_patterns['middle_name'])
        
        # Try comma format (CRUZ, JUAN S.)
        if not names['last_name'] and not names['first_name']:
            comma_match = re.search(r'\b([A-Z]+),\s*([A-Z\s.]+)', text)
            if comma_match:
                names['last_name'] = comma_match.group(1).strip()
                first_middle = comma_match.group(2).strip().split()
                if first_middle:
                    names['first_name'] = first_middle[0]
                    if len(first_middle) > 1:
                        names['middle_name'] = ' '.join(first_middle[1:])
        
        # Try full name pattern
        names['full_name'] = self._extract_pattern(text, self.name_patterns['full_name'])
        
        # If no labeled fields found, try to find name from general text
        if not any(names.values()):
            # Look for lines that look like names
            lines = text.split('\n')
            for line in lines:
                line = line.strip()
                # Check if line looks like a name (2-4 capitalized words)
                if re.match(r'^[A-Z][A-Z\s.,-]{2,}$', line) and len(line.split()) in [2, 3, 4]:
                    names['full_name'] = line
                    break
        
        return {k: v for k, v in names.items() if v}
    
    def _extract_id_number(self, text: str) -> Dict:
        """Extract ID number"""
        for pattern in self.id_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                # Check if it's a plausible ID number (not a date, etc.)
                id_num = match.group(1).strip()
                if len(id_num) >= 6 and not re.match(r'^\d{1,2}[/\-]\d{1,2}[/\-]\d{4}$', id_num):
                    return {'id_number': id_num}
        return {}
    
    def _extract_address(self, text: str) -> Dict:
        """Extract address"""
        for pattern in self.address_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                address = match.group(1).strip()
                if len(address) > 5:  # Reasonable address length
                    return {'address': address}
        return {}
    
    def _extract_birth_date(self, text: str) -> Dict:
        """Extract birth date"""
        for pattern in self.date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                date_str = match.group(1).strip()
                # Basic date validation
                if re.match(r'\d{1,2}[/\-]\d{1,2}[/\-]\d{4}', date_str):
                    return {'birth_date': date_str}
        return {}
    
    def _extract_pattern(self, text: str, patterns: List[str]) -> Optional[str]:
        """Extract using multiple patterns"""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def _format_ph_name(self, first: str, middle: str, last: str, id_type: str = None) -> str:
        """Format Philippine name to First Middle Last"""
        parts = []
        
        if first:
            parts.append(first)
        
        if middle:
            # Handle middle initials
            if len(middle) == 1 or (len(middle) == 2 and middle.endswith('.')):
                parts.append(middle)
            else:
                parts.append(middle)
        
        if last:
            parts.append(last)
        
        if parts:
            formatted = ' '.join(parts)
            
            # Handle specific ID types
            if id_type in ['National ID (PhilSys)', 'Drivers License (LTO)', 'Passport']:
                # These often have comma format, but we want standard format
                return formatted
            
            return formatted
        
        return ''
    
    def _clean_fields(self, fields: Dict) -> Dict:
        """Clean extracted fields"""
        cleaned = {}
        
        for key, value in fields.items():
            if value:
                # Remove extra spaces, normalize
                cleaned_value = re.sub(r'\s+', ' ', value).strip()
                
                # Remove common artifacts
                cleaned_value = re.sub(r'[^\w\s\-,.]', '', cleaned_value)
                
                # Capitalize properly for names
                if key in ['full_name', 'first_name', 'middle_name', 'last_name']:
                    # Convert to title case but preserve all caps for acronyms
                    words = cleaned_value.split()
                    cleaned_words = []
                    for word in words:
                        if word.isupper() and len(word) <= 3:
                            cleaned_words.append(word)  # Keep J.R., S.A., etc.
                        else:
                            cleaned_words.append(word.title())
                    cleaned_value = ' '.join(cleaned_words)
                
                cleaned[key] = cleaned_value
        
        return cleaned
    
    def detect_id_type_from_text(self, text: str) -> str:
        """Try to detect ID type from text content"""
        text_upper = text.upper()
        
        # Check for specific ID markers
        if re.search(r'PHILSYS|NATIONAL ID|PSN', text_upper):
            return 'National ID (PhilSys)'
        elif re.search(r'DRIVER|LICENSE|LTO', text_upper):
            return 'Drivers License (LTO)'
        elif re.search(r'PASSPORT|DEPARTMENT OF FOREIGN AFFAIRS', text_upper):
            return 'Philippine Passport'
        elif re.search(r'UMID|UNIFIED MULTI-PURPOSE', text_upper):
            return 'UMID (Unified Multi-Purpose ID)'
        elif re.search(r'SSS|SOCIAL SECURITY', text_upper):
            return 'SSS ID (Social Security System)'
        elif re.search(r'PHILHEALTH', text_upper):
            return 'PhilHealth ID'
        elif re.search(r'POSTAL ID', text_upper):
            return 'Postal ID'
        elif re.search(r'BARANGAY ID|BRGY', text_upper):
            return 'Barangay ID'
        elif re.search(r'TIN|TAX IDENTIFICATION', text_upper):
            return 'TIN ID (Tax Identification Number)'
        elif re.search(r'VOTER', text_upper):
            return 'Voters ID'
        
        return 'Unknown'

# Singleton instance
field_extractor = PhilippineFieldExtractor()

# Main function for testing
if __name__ == "__main__":
    # Test with sample Philippine ID text
    test_text = """
    REPUBLIC OF THE PHILIPPINES
    LAND TRANSPORTATION OFFICE
    
    DRIVER'S LICENSE
    LAST NAME: CRUZ
    FIRST NAME: JUAN
    MIDDLE NAME: SANTOS
    ADDRESS: BRGY. LAJONG, BULAN, SORSOGON
    LICENSE NO: N01-23-456789
    BIRTH DATE: 01/15/1990
    """
    
    fields = field_extractor.extract_fields(test_text, 'Drivers License (LTO)')
    print("Extracted fields:", fields)
    print("Detected ID type:", field_extractor.detect_id_type_from_text(test_text))