import asyncio
import csv
import json
from pathlib import Path
from playwright.async_api import async_playwright


async def main():
    root = Path(__file__).resolve().parents[1]
    output = root / 'work-validacion-politica'
    output.mkdir(exist_ok=True)
    with (root / 'politicas/garantias-catalogos.csv').open(newline='') as f:
        labels = {row['categoria']: row['plazo'] for row in csv.DictReader(f)}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        results = []
        for width in [320, 390, 768, 1280]:
            page = await browser.new_page(viewport={'width': width, 'height': 900}, device_scale_factor=1)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            # Solo archivos locales. No se abre el catálogo, el Worker de Alex ni canales de contacto.
            await page.route('http://**/*', lambda route: route.abort())
            await page.route('https://**/*', lambda route: route.abort())
            await page.goto((root / 'cambios-devoluciones-garantias/index.html').as_uri())
            await page.wait_for_load_state('load')
            data = await page.evaluate('''(labels) => ({width:innerWidth,documentWidth:document.documentElement.scrollWidth,h1:document.querySelector('h1').textContent,images:[...document.images].map(i=>({loaded:i.complete&&i.naturalWidth>0})),badAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.querySelector(a.getAttribute('href'))).length,review:document.body.textContent.includes('Borrador para aprobación'),warranty:document.body.textContent.includes(labels.celulares),accessories:document.body.textContent.includes(labels.accesorios),legal:document.body.textContent.includes('quince'),footerPolicy:!!document.querySelector('footer a[aria-current="page"]')})''', labels)
            assert data['documentWidth'] <= width, data
            assert all(image['loaded'] for image in data['images']), data
            assert data['badAnchors'] == 0, data
            assert all(data[key] for key in ['review', 'warranty', 'accessories', 'legal', 'footerPolicy']), data
            assert not errors, errors
            if width in [390, 1280]:
                await page.screenshot(path=str(output / ('vista-' + str(width) + '.png')), full_page=True)
                await page.screenshot(path=str(output / ('portada-' + str(width) + '.png')), full_page=False)
            results.append(data)
            await page.close()
        await browser.close()
    (output / 'validacion-visual.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(results, ensure_ascii=False))


asyncio.run(main())
