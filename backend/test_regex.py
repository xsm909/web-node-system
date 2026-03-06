import re

def test_regex():
    patterns = [
        "@table-AI_Tasks->id,AI_Tasks->description",
        "@table->AI_Tasks->id,AI_Tasks->description",
    ]
    
    # regex = r"@table[-|>]+([^->,]+)->([^->,]+),([^->,]+)->([^->,]+)"
    # Refined regex to handle different cases
    regex = r"@table[-|>]+([\w]+)->([\w]+),([\w]+)->([\w]+)"
    
    for p in patterns:
        match = re.search(regex, p)
        if match:
            print(f"Match found for '{p}':")
            print(f"  Table 1: {match.group(1)}")
            print(f"  Field 1: {match.group(2)}")
            print(f"  Table 2: {match.group(3)}")
            print(f"  Field 2: {match.group(4)}")
        else:
            print(f"No match for '{p}'")

if __name__ == "__main__":
    test_regex()
