import os
import csv
import urllib.request
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import RamenShop

RAMEN_DATA_URL = "https://raw.githubusercontent.com/choko510/jiro-database/refs/heads/main/jiro.csv"
CACHE_DIR = "cache"
CACHE_FILE = "jiro.csv"
# ルートディレクトリからの相対パス、または絶対パスにする必要があります。
# jirotterのルートディレクトリを特定するために、このファイルの場所から遡ります。
# app/utils/ramen_data_sync.py -> app/utils -> app -> root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
CACHE_PATH = os.path.join(BASE_DIR, CACHE_DIR, CACHE_FILE)

def ensure_cache_dir():
    cache_dir = os.path.dirname(CACHE_PATH)
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)

def should_download_data() -> bool:
    if not os.path.exists(CACHE_PATH):
        return True
    
    last_modified_time = os.path.getmtime(CACHE_PATH)
    last_modified_date = datetime.fromtimestamp(last_modified_time)
    
    # 1日以上経過していたら
    return datetime.now() - last_modified_date > timedelta(days=1)

def download_ramen_data():
    ensure_cache_dir()
    print(f"Downloading ramen data from {RAMEN_DATA_URL}...")
    try:
        # User-Agentを設定しないと403になることがあるので念のため設定
        req = urllib.request.Request(
            RAMEN_DATA_URL, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as response:
            data = response.read()
            with open(CACHE_PATH, 'wb') as f:
                f.write(data)
        print("Download complete.")
    except Exception as e:
        print(f"Failed to download ramen data: {e}")

def sync_ramen_data(db: Session):
    """
    ラーメンデータを同期する。
    1. 必要であればデータをダウンロードしてキャッシュする。
    2. データをDBに反映する（新規追加・更新）。
    """
    if should_download_data():
        download_ramen_data()
    
    if not os.path.exists(CACHE_PATH):
        print("No ramen data available to load.")
        return

    try:
        with open(CACHE_PATH, 'r', encoding='utf-8-sig') as file:
            csv_reader = csv.DictReader(file)
            
            # 既存データを確認して更新または追加を行う
            # メモリ効率のため、まずは店名で既存レコードマップを作成
            existing_shops = {shop.name: shop for shop in db.query(RamenShop).all()}
            
            new_shops_count = 0
            updated_shops_count = 0

            for row in csv_reader:
                try:
                    name = row['店名']
                    # 必須フィールドの欠損チェック
                    if not name or not row['緯度'] or not row['経度']:
                        continue
                        
                    latitude = float(row['緯度'])
                    longitude = float(row['経度'])
                    
                    if name in existing_shops:
                        # 既存店舗の更新
                        shop = existing_shops[name]
                        # 変更検知ロジックを入れるとDB負荷が下がるが、
                        # 今回は複雑さを避けてそのまま上書きする
                        shop.address = row['住所']
                        shop.business_hours = row['営業時間']
                        shop.closed_day = row['定休日']
                        shop.seats = row['座席']
                        shop.latitude = latitude
                        shop.longitude = longitude
                        # wait_time は更新しない
                        updated_shops_count += 1
                    else:
                        # 新規店舗
                        new_shop = RamenShop(
                            name=name,
                            address=row['住所'],
                            business_hours=row['営業時間'],
                            closed_day=row['定休日'],
                            seats=row['座席'],
                            latitude=latitude,
                            longitude=longitude,
                            wait_time=0
                        )
                        db.add(new_shop)
                        new_shops_count += 1
                        
                except (ValueError, KeyError) as e:
                    print(f"Skipping row due to parsing error: {row} - {e}")
                    continue
            
            db.commit()
            print(f"Ramen data synced: {new_shops_count} new, {updated_shops_count} updated.")
            
    except Exception as e:
        db.rollback()
        print(f"Error syncing ramen data: {e}")
