import urllib.request
import os

assets_dir = "assets"
if not os.path.exists(assets_dir):
    os.makedirs(assets_dir)

# Twemoji 14.0.2 URLs
emojis = {
    "APPLE": "1f34e",
    "ORANGE": "1f34a",
    "LEMON": "1f34b",
    "BELL": "1f514",
    "WATERMELON": "1f349",
    "STAR": "2b50",
    "TRAIN": "1f682",
    "JACKPOT": "1f4b0"
}

base_url = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/{}.png"

for name, code in emojis.items():
    url = base_url.format(code)
    filepath = os.path.join(assets_dir, f"{name}.png")
    print(f"Downloading {name} from {url}...")
    try:
        urllib.request.urlretrieve(url, filepath)
        print(f"Saved to {filepath}")
    except Exception as e:
        print(f"Failed to download {name}: {e}")

print("Done downloading assets.")
