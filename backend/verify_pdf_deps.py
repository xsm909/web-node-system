import sys

def verify_weasyprint():
    try:
        from weasyprint import HTML
        print("Successfully imported weasyprint.HTML")
        
        # Try a simple conversion to ensure libs are present
        html = HTML(string="<h1>Test</h1>")
        pdf = html.write_pdf()
        print(f"Successfully generated a test PDF ({len(pdf)} bytes)")
        return True
    except ImportError as e:
        print(f"ImportError: {e}")
        return False
    except Exception as e:
        print(f"Error during PDF generation: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if verify_weasyprint():
        sys.exit(0)
    else:
        sys.exit(1)
