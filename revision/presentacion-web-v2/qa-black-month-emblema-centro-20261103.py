from pathlib import Path
from PIL import Image
import json, sys
out=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).with_name('black-month-emblema-20261103')
rows=[]
for width in [1440,390]:
    before=Image.open(out/f'antes-{width}-esfera.png').convert('RGBA')
    after=Image.open(out/f'despues-{width}-esfera.png').convert('RGBA')
    assert before.size==after.size
    compared=changed=0
    for y in range(before.height):
        for x in range(before.width):
            if (x-before.width/2)**2+(y-before.height/2)**2<(before.width*.38)**2:
                compared+=1
                changed+=before.getpixel((x,y))!=after.getpixel((x,y))
    assert changed==0, (width,changed)
    rows.append({'anchoVista':width,'pixelesComparados':compared,'diferencias':changed})
report=json.loads((out/'resultado.json').read_text())
report['conservacionCentroLogo']={'referencia':'Esfera original sin el distintivo anterior superpuesto','radioRelativo':.38,'resultados':rows}
(out/'resultado.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(rows,ensure_ascii=False))
