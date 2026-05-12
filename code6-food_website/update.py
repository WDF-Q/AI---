 import re
file_path = 'd:\\AI 相關資料\\Antigravity 軟體\\AI工作區\\code6-food_website\\restaurants.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace address lines
def replace_address(match):
    address = match.group(1)
    # create google maps link
    encoded_addr = address.replace(' ', '')
    map_link = f'<a href="https://www.google.com/maps/search/?api=1&query={encoded_addr}" target="_blank" class="map-link" style="text-decoration:none; margin-right:5px;" title="在地圖中開啟">🗺️ 地圖</a>'
    return f'<span>{map_link}{address}</span>'

content = re.sub(r'<span>(台南市.*?)</span>', replace_address, content)

# Add navbar link
content = content.replace('<li><a href="index.html">返回首頁</a></li>', '<li><a href="index.html">返回首頁</a></li>\n                    <li><a href="ai_seafood.html">AI 吃海鮮</a></li>')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated restaurants.html')
