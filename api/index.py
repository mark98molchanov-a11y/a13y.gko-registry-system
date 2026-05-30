# api/index.py - ТЕСТОВАЯ ВЕРСИЯ
import json

def handler(request):
    print("=== TEST FUNCTION CALLED ===")
    
    try:
        data = request.get_json() if hasattr(request, 'get_json') else {}
        if not data:
            import sys
            data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
        
        args = data.get('args', [])
        
        result = {
            "status": "ok",
            "message": "API is working!",
            "received_args": args,
            "predicted": {
                "price_per_sqm": 45000,
                "price_total": 45000 * (args[0] if len(args) > 0 else 0)
            }
        }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(result, ensure_ascii=False)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
