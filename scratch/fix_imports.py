import os
import re

TARGET_DIR = r"d:\Shop management\src\app\(authenticated)"

REPLACEMENTS = [
    # Replace triple dot/slash and double dot/slash references with aliases
    (r"\.\./\.\./\.\./validation", "@/validation"),
    (r"\.\./\.\./validation", "@/validation"),
    
    (r"\.\./\.\./\.\./hooks/", "@/hooks/"),
    (r"\.\./\.\./hooks/", "@/hooks/"),
    
    (r"\.\./\.\./\.\./lib/", "@/lib/"),
    (r"\.\./\.\./lib/", "@/lib/"),
    
    (r"\.\./\.\./\.\./components/", "@/components/"),
    (r"\.\./\.\./components/", "@/components/"),
    
    (r"\.\./\.\./\.\./db/", "@/db/"),
    (r"\.\./\.\./db/", "@/db/"),
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    for pattern, replacement in REPLACEMENTS:
        new_content = re.sub(pattern, replacement, new_content)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

def main():
    for root, dirs, files in os.walk(TARGET_DIR):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
