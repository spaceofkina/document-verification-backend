from flask import Flask

app = Flask(__name__)

@app.route('/test', methods=['POST'])
def test():
    return {'message': 'POST works!'}

@app.route('/test', methods=['GET'])
def test_get():
    return {'message': 'GET works!'}

if __name__ == '__main__':
    print("Routes:")
    for rule in app.url_map.iter_rules():
        print(f"  {rule.rule} -> {rule.endpoint}")
    app.run(port=5001, debug=True)