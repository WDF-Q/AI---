
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on('console', lambda msg: print(f'CONSOLE: {msg.text}'))
    page.on('pageerror', lambda err: print(f'ERROR: {err}'))
    
    print('Navigating...')
    page.goto('http://127.0.0.1:8000/code9_%E8%B3%93%E6%9E%9C%E5%BD%A9%E8%99%B9/index.html')
    page.wait_for_timeout(1000)
    print('Clicking start...')
    page.click('#btn-start')
    page.wait_for_timeout(3000)
    print('Done.')
    browser.close()
