"""Adaptador de imagen web del motor SIGNATURE existente; sin cron ni inventario nuevo.
Usa el mismo resolver de fotografía que la web y llama fabrica.run con un SKU.
No publica: el publicador original debe verificar bytes en Drive antes de habilitar Alex.
"""
from __future__ import annotations
from contextlib import contextmanager
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import subprocess
from threading import RLock

_LOCK=RLock()
_HASH=re.compile(r"^[a-f0-9]{64}$")
_SKU=re.compile(r"^[A-Z][A-Z0-9]{2,20}$")
PILOT=frozenset(("REL046","TELE002","TELF011","AUDI091"))

class VisualSourceError(ValueError):pass

def sha256_file(path):
    h=hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda:stream.read(1024*1024),b""):h.update(block)
    return h.hexdigest()

def approved_state(value):
    if value is True:return True
    if isinstance(value,str):return value in {"APROBADO","VERIFICADO"}
    return isinstance(value,dict) and value.get("estado") in {"APROBADO","VERIFICADO"}

def _local(repo,url):
    if not isinstance(url,str):raise VisualSourceError("Ruta visual ausente")
    prefix="https://conectatech-ec.github.io/"
    relative=url[len(prefix):] if url.startswith(prefix) else url.lstrip("/")
    if "://" in relative or "?" in relative or "#" in relative:
        raise VisualSourceError("Usar la ruta canónica del activo aprobado")
    path=(repo/relative).resolve()
    if not path.is_relative_to(repo.resolve()) or not relative.startswith("imagenes/"):
        raise VisualSourceError("Imagen fuera del catálogo autorizado")
    if path.suffix.lower() not in {".png",".webp",".jpg",".jpeg"}:
        raise VisualSourceError("Formato visual no admitido")
    return path

@dataclass(frozen=True)
class WebPhoto:
    sku:str
    master:Path
    master_sha256:str
    primary:Path
    primary_sha256:str
    primary_url:str
    web_commit:str
    descriptor:dict

    def signature_descriptor(self,repo):
        return {**self.descriptor,"original":"/"+self.master.relative_to(repo.resolve()).as_posix(),
            "sha256_original":self.master_sha256,"revision_visual":True,
            "fuente":"https://conectatech-ec.github.io/"+self.primary.relative_to(repo.resolve()).as_posix()}

    def manifest_fields(self,repo):
        return {"fuente":"FOTOGRAFIA_PRINCIPAL_WEB_APROBADA",
            "maestro":self.master.relative_to(repo.resolve()).as_posix(),
            "maestro_sha256":self.master_sha256,
            "principal":self.primary.relative_to(repo.resolve()).as_posix(),
            "principal_sha256":self.primary_sha256,"web_commit":self.web_commit,
            "estado":"FUENTE_VERIFICADA"}

def verify_web_photo(repo,sku,row,web_commit):
    repo=Path(repo).resolve()
    if not _SKU.fullmatch(sku):raise VisualSourceError("SKU inválido")
    if not isinstance(row,dict):raise VisualSourceError("Sin principal web; no usar fotografía alternativa")
    img=row.get("imagenProfesional") or {}
    if not approved_state(img.get("revision_visual")):
        raise VisualSourceError("La principal web no tiene revisión visual aprobada")
    if img.get("contiene_caja") is not False or img.get("posicion",1)!=1:
        raise VisualSourceError("Se requiere producto principal aprobado sin caja")
    variant=(img.get("versiones") or {}).get("1200") or {}
    primary_url=row.get("imagen")
    if primary_url!=variant.get("url"):
        raise VisualSourceError("La principal y su descriptor de revisión discrepan")
    master=_local(repo,img.get("original"));primary=_local(repo,primary_url)
    expected=img.get("sha256_original");version_hash=variant.get("sha256")
    if not _HASH.fullmatch(expected or "") or not _HASH.fullmatch(version_hash or ""):
        raise VisualSourceError("Faltan huellas de contenido")
    if not master.is_file() or not primary.is_file():
        raise VisualSourceError("Falta activo aprobado; no sustituirlo por otro modelo o caché")
    if sha256_file(master)!=expected or sha256_file(primary)!=version_hash:
        raise VisualSourceError("Los bytes visuales difieren del registro publicado")
    return WebPhoto(sku,master,expected,primary,version_hash,primary_url,web_commit,img)

def current_sources(repo,skus):
    """Resolver existente usado por exportaciones/web; no lee un contrato fotográfico viejo."""
    repo=Path(repo).resolve()
    head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=repo,text=True).strip()
    script=repo/"scripts/editorial-fotografia-efectiva.cjs"
    if not script.is_file():raise VisualSourceError("Falta el resolver oficial de imágenes web")
    raw=subprocess.check_output(["node",str(script)],cwd=repo,text=True)
    data=json.loads(raw)
    after=subprocess.check_output(["git","rev-parse","HEAD"],cwd=repo,text=True).strip()
    if head!=after:raise VisualSourceError("Cambió la publicación durante la lectura; reintentar")
    good,bad={},{}
    for sku in skus:
        try:good[sku]=verify_web_photo(repo,sku,data.get(sku),head)
        except (VisualSourceError,OSError,ValueError) as e:bad[sku]=str(e)
    return good,bad

def source_changed(previous,source):
    """Compara bytes, no sólo URL/fecha; un recorte cacheado no decide la fuente."""
    stored=(previous or {}).get("fuente_visual_web") or {}
    return (stored.get("maestro_sha256"),stored.get("principal_sha256"))!=(
        source.master_sha256,source.primary_sha256)

def event_selection(event,known_skus):
    if event.get("type")!="imagen_web_aprobada":
        raise VisualSourceError("Evento fotográfico no reconocido")
    if event.get("publicacion_verificada") is not True:
        raise VisualSourceError("El evento aún no acredita publicación")
    selected=event.get("skus")
    if not isinstance(selected,list) or any(not isinstance(x,str) or not _SKU.fullmatch(x) for x in selected):
        raise VisualSourceError("Lista SKU inválida")
    return sorted(set(selected)&set(known_skus))

@contextmanager
def _same_renderer_source(factory,source,repo):
    """Inyección acotada y serializada; no modifica fábrica.py ni archivos web."""
    original=factory.verified
    def selected(repo_arg,sku,row,media):
        c,img,photo,specs=original(repo_arg,sku,row,media)
        if sku!=source.sku:raise VisualSourceError("El renderer intentó regenerar otro SKU")
        # Volver a verificar justo antes del render evita un archivo cambiado en paralelo.
        if sha256_file(source.master)!=source.master_sha256 or sha256_file(source.primary)!=source.primary_sha256:
            raise VisualSourceError("Imagen cambió después de seleccionar; volver a resolver")
        return c,source.signature_descriptor(Path(repo).resolve()),source.master,specs
    factory.verified=selected
    try:yield
    finally:factory.verified=original

def regenerate_sku(factory,repo,hub_snapshot,out,sku,source,*,allow_all=False):
    """Entrada individual usando el snapshot Hub vigente, sin exigir otro Excel.
    Mantiene logo, escenas, tipografía, precios y fecha en el renderer original.
    La configuración BLACK MONTH sigue siendo responsabilidad de ese renderer.
    No invoca el publicador ni aprueba resultados por sí sola.
    """
    if not allow_all and sku not in PILOT:
        raise VisualSourceError("Despliegue masivo bloqueado hasta verificar los cuatro pilotos")
    if source.sku!=sku:raise VisualSourceError("Fuente de otro SKU")
    out=Path(out)
    state=factory.read(out/"manifiesto.json") if (out/"manifiesto.json").exists() else {"productos":{}}
    old=state.get("productos",{}).get(sku,{})
    if not source_changed(old,source):
        return {"sku":sku,"estado":"SIN_CAMBIO_VISUAL","publicado":False,"regen":False}
    # Igual hash maestro pero derivado visual distinto también se invalida.
    with _LOCK:
        with _same_renderer_source(factory,source,repo):
            factory.run(Path(repo),Path(hub_snapshot),out,[sku],1,render_gallery=False)
    state=factory.read(out/"manifiesto.json")
    entry=state.get("productos",{}).get(sku)
    if not entry:raise VisualSourceError("Renderer no devolvió el SKU")
    if entry.get("estado") in {"BLOQUEADO","DESACTUALIZADO"}:
        return {"sku":sku,"estado":entry["estado"],"motivo":entry.get("motivo"),"publicado":False}
    observed=(entry.get("fotografia_fuente") or {}).get("maestro_sha256")
    if observed!=source.master_sha256:
        raise VisualSourceError("Renderer no utilizó el maestro vigente")
    entry["fuente_visual_web"]=source.manifest_fields(repo)
    entry["foto_web_actualizada"]=True
    entry["apto_envio"]=False
    entry["publicado"]=False
    entry["estado_publicacion"]="GENERADO_PENDIENTE_VERIFICACION_DRIVE"
    # El publicador original es quien actualiza aprobación/distribución tras readback real.
    factory.save(out/"manifiesto.json",state)
    return {"sku":sku,"estado":"GENERADO_PENDIENTE_VERIFICACION_DRIVE","publicado":False,"regen":True}

def batch(factory,repo,hub_snapshot,out,skus,*,allow_all=False):
    good,bad=current_sources(repo,skus)
    results=[]
    for sku in skus:
        try:
            if sku in bad:raise VisualSourceError(bad[sku])
            results.append(regenerate_sku(factory,repo,hub_snapshot,out,sku,good[sku],allow_all=allow_all))
        except (VisualSourceError,OSError,ValueError,KeyError) as error:
            results.append({"sku":sku,"estado":"ERROR_AISLADO","motivo":str(error),"publicado":False})
    return results
