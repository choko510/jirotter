import uvicorn

if __name__ == '__main__':
    # 開発モードでリロードを有効化
    uvicorn.run("app:create_app", host="localhost", port=8000, reload=True, factory=True)