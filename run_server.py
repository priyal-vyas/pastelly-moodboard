import http.server
import socketserver
import webbrowser
import threading
import time

PORT = 8080
Handler = http.server.SimpleHTTPRequestHandler

def open_browser():
    # Wait a moment for server to initialize
    time.sleep(1.5)
    url = f"http://localhost:{PORT}"
    print(f"Opening browser at {url}...")
    webbrowser.open(url)

if __name__ == "__main__":
    # Start browser-opener in a separate thread so it doesn't block the server startup
    threading.Thread(target=open_browser, daemon=True).start()
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Hosting Pinterest Mood Board Generator UI Mockup on port {PORT}...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.server_close()
