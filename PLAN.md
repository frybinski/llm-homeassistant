# Plan: LLM-gestütztes Entwurfswerkzeug für Home Assistant

Arbeitstitel: **Blaupause** (Domain `blaupause`). Name und Domain sind vorläufig und vor dem ersten Release festzulegen.

Stand: 18.11.2026. Dieses Dokument ist der Einstieg für die Entwicklungssitzung. Es liegt im Repo als `PLAN.md` und wird dort fortgeschrieben.

## 1. Ziel

Eine Custom Integration für Home Assistant, mit der sich Automationen und Dashboards in natürlicher Sprache erstellen und ändern lassen. Die Bedienung erfolgt in einem eigenen Panel in der HA-Seitenleiste.

Abgrenzung zu vorhandenen Lösungen (ha-mcp, AI Agent HA, Selora AI): Das Modell schreibt nie direkt in die Konfiguration. Es erzeugt einen Änderungsvorschlag. Eine deterministische Prüfschicht validiert ihn, der Mensch sieht eine Vorschau und entscheidet.

## 2. Leitprinzipien

1. **Vorschlag statt Aktion.** Jede Änderung ist ein Change Set mit Status. Geschrieben wird erst nach Bestätigung.
2. **Strukturierte Ausgabe.** Das Modell liefert JSON nach Schema, kein freies YAML.
3. **Deterministisch prüfen.** Alles, was sich ohne Modell prüfen lässt, wird ohne Modell geprüft. Fehler gehen als Rückmeldung in eine begrenzte Reparaturschleife.
4. **Umkehrbar.** Vor jedem Schreiben ein Schnappschuss, Rückgängig mit einem Klick.
5. **Modellunabhängig.** Lokale Modelle (Ollama) und Cloud-Modelle sind austauschbar.
6. **Nativ.** Das Panel nutzt HA-Komponenten und HA-Themes.
7. **Nachvollziehbar.** Jeder Vorschlag wird mit Prüfergebnis und Entscheidung protokolliert.

## 3. Architektur

```
Panel (Lit/TS)  <-- WebSocket -->  Integration (Python)
                                     |- context    Hausmodell und Auswahl des Ausschnitts
                                     |- drafting   Modellaufruf, strukturierte Ausgabe
                                     |- checks     Validierung, Konfliktanalyse
                                     |- changeset  Zustandsautomat, Speicherung
                                     |- apply      Schreiben, Schnappschuss, Rückgängig
                                     |- journal    Protokoll
```

### Pipeline

| Schritt | Inhalt |
|---|---|
| Kontext | Entitäten, Geräte, Bereiche, Labels, bestehende Automationen. Zur Anfrage wird ein Ausschnitt gewählt (zunächst Schlagwort- und Bereichsfilter, später Embeddings). |
| Entwurf | Modell erhält Anfrage, Ausschnitt und Zielschema. Ergebnis ist ein Change Set. |
| Prüfung | Siehe Abschnitt 5. Bei Fehlern maximal 3 Reparaturrunden. |
| Vorschau | Automationen als Diff (YAML-Ansicht), Dashboards live gerendert. |
| Übernehmen | Schnappschuss, Schreiben über HA-Schnittstellen, Neuladen. |
| Rückgängig | Schnappschuss zurückspielen. |

### Change Set

```json
{
  "id": "cs_...",
  "request": "Text der Anfrage",
  "status": "draft | checked | failed | applied | reverted | discarded",
  "operations": [
    {
      "kind": "automation | script | helper | dashboard_view | dashboard_card",
      "op": "create | update | delete",
      "target_id": "...",
      "before": {},
      "after": {}
    }
  ],
  "findings": [
    {"severity": "error | warning | info", "check": "...", "message": "...", "path": "..."}
  ],
  "model": "...",
  "rounds": 0,
  "created": "...",
  "decided": "..."
}
```

Zustände: `draft -> checked -> applied -> reverted`, daneben `failed` und `discarded`. Fehler der Stufe `error` blockieren das Übernehmen, Warnungen nicht.

## 4. Schnittstellen zu Home Assistant

**Verifiziert am 18.11.2026** gegen den Quellcode von Home Assistant Core 2026.10.4 (die Version, die `pytest-homeassistant-custom-component` 0.13.375 festschreibt) und gegen den Entwickler-Blog. Das aktuelle Release 2026.11.2 wurde nicht gesondert geprüft.

| Zweck | Schnittstelle (Stand 2026.10) | Befund |
|---|---|---|
| Panel registrieren | `panel_custom.async_register_panel(hass, frontend_url_path=, webcomponent_name=, module_url=, sidebar_title=, sidebar_icon=, require_admin=, config=)`; Entfernen mit `frontend.async_remove_panel(hass, frontend_url_path)`. Statische Dateien: `await hass.http.async_register_static_paths([StaticPathConfig(url_path, path, cache_headers)])` (`StaticPathConfig` aus `homeassistant.components.http`) | Bestätigt. `frontend.async_register_built_in_panel` ist für eingebaute Panels gedacht, wir nutzen `panel_custom`. Manifest braucht `dependencies` auf `http`, `frontend`, `panel_custom`. |
| Eigene Kommandos | `websocket_api.async_register_command(hass, handler)` mit `@websocket_api.websocket_command({...})`, `@websocket_api.require_admin`, `@websocket_api.async_response` | Bestätigt. |
| Register lesen | `entity_registry`, `device_registry`, `area_registry`, `label_registry` | Bestätigt. Zusätzlich vorhanden: `floor_registry`, `category_registry`. |
| Automation validieren | `homeassistant.components.automation.config.async_validate_config_item(hass, config_key, config)` wirft bei Fehlern `Invalid` bzw. `HomeAssistantError` und liefert sonst eine `AutomationConfig` mit `validation_status`. WebSocket `validate_config` mit den Schlüsseln `triggers`, `conditions`, `actions` liefert je Schlüssel `{valid, error}`. | Bestätigt. Das Modul ist komponentenintern (kein öffentlicher Export), Zugriff kapseln. |
| Bestehende Automationen lesen | `hass.data[automation.DATA_COMPONENT].entities`, je Entität `raw_config` sowie `referenced_entities`, `referenced_devices`, `referenced_areas`, `referenced_labels`, `referenced_floors` | Ergänzt. Deckt auch YAML-basierte Automationen ab und ist die Grundlage für Stufe C. |
| Automation schreiben | REST `POST` bzw. `DELETE /api/config/automation/config/{id}` (`EditAutomationConfigView`): validiert, schreibt `automations.yaml`, ruft `automation.reload` mit `{"id": ...}` (lädt nur diese eine Automation neu); beim Löschen wird der Registry-Eintrag entfernt. | **Abweichung:** Es gibt weder eine Python-API noch ein WebSocket-Kommando. Der View serialisiert Schreibzugriffe über einen eigenen `mutation_lock`, an den eine Integration nicht herankommt. Siehe „Offen für M1“. |
| Templates prüfen | `Template(template, hass)`, dann `ensure_valid()` für die Syntax und `async_render(variables, parse_result, limited, strict, log_fn)` | Bestätigt. `hass` ist Pflichtargument. `strict=True` macht undefinierte Variablen zu Fehlern. |
| Dashboards | WebSocket `lovelace/config`, `lovelace/config/save`, `lovelace/config/delete`, `lovelace/info` (Speichern und Löschen nur für Administratoren). In Python: `hass.data[LOVELACE_DATA].dashboards[url_path]` mit `mode`, `async_load(force)`, `async_save(config)`. | Bestätigt. YAML-Dashboards haben `mode == "yaml"` und lehnen `async_save` ab. |
| Modellaufruf | Dienst `ai_task.generate_data` (`task_name`, `instructions`, `entity_id`, `structure`, `attachments`) bzw. in Python `ai_task.async_generate_data(hass, task_name=, entity_id=, instructions=, structure=)` mit Ergebnis `GenDataTaskResult.data` | **Abweichung:** `structure` ist kein JSON-Schema, sondern ein Feld-Dict `{name: {selector, description, required}}`, aus dem HA ein Schema aus Selektoren baut. Siehe „Offen für M1“. |

### Weitere Befunde

- **Probatio statt voluptuous.** Seit Core 2026.9 läuft die Schema-Validierung auf `probatio`. Der Core importiert `probatio` direkt, `import voluptuous as vol` wird beim Start auf Probatio umgeleitet und funktioniert unverändert weiter ([Entwickler-Blog vom 30.09.2026](https://developers.home-assistant.io/blog/2026/09/30/probatio-validation-engine)). Wir bleiben beim `voluptuous`-Import, das funktioniert auf alten und neuen Versionen.
- **Python 3.14.** Core 2026.10 und 2026.11 setzen Python 3.14 voraus. Tests und Devcontainer laufen auf 3.14.
- **Mindestversion.** `manifest.json` kennt kein Feld für eine HA-Mindestversion. Sie steht in `hacs.json` (`homeassistant`) und wird zusätzlich beim Setup zur Laufzeit geprüft. Festgelegt auf 2026.10.0, weil gegen diese Linie getestet wird.
- **Brand-Bilder.** Seit Core 2026.3 liefern Custom Integrations ihr Icon selbst aus: `custom_components/blaupause/brand/icon.png` ([Entwickler-Blog vom 24.02.2026](https://developers.home-assistant.io/blog/2026/02/24/brands-proxy-api)). Die HACS-Validierung prüft dieses Verzeichnis.
- **HACS-Validierung.** Die Prüfungen `description` und `topics` hängen an den GitHub-Repo-Einstellungen, nicht am Code. Beides ist im Repo noch nicht gesetzt.

### Offen für M1

- **Automationen schreiben.** Zwei Wege: (a) Das Backend schreibt `automations.yaml` selbst mit denselben Lese- und Schreibhelfern wie der View und ruft danach `automation.reload` mit der ID auf. Eigenes Lock, Restrisiko bei gleichzeitiger Bearbeitung im HA-Editor. (b) Das Backend ruft den REST-Endpunkt der eigenen Instanz auf und nutzt damit Validierung, Lock und Reload des Views. Vorschlag: (a), weil Schnappschuss und Schreiben dann in einer Hand liegen; den Schnappschuss unmittelbar vor dem Schreiben unter dem eigenen Lock ziehen.
- **Strukturierte Ausgabe über AI Task.** Verschachtelung geht nur über den `object`-Selektor mit `fields` und `multiple`. Frei geformte Teile wie die Automation-Konfiguration in `after` lassen sich nur als untypisiertes Objekt beschreiben. Ob Modelle damit zuverlässig Change Sets liefern, ist in M1 als Erstes zu testen. Rückfall bleibt der eigene OpenAI-kompatible Client mit echtem JSON-Schema.

Bekannte Einschränkung: Automationen und Dashboards im YAML-Modus (Pakete, `!include`) können nicht über die UI-Schnittstellen geschrieben werden. In Stufe 1 werden sie nur gelesen und in der Konfliktanalyse berücksichtigt.

## 5. Prüfungen

**Stufe A, Gültigkeit**
- Schema der Automation bzw. der Karte
- Entitäten, Geräte, Bereiche existieren
- Aktionen (Services) existieren, Pflichtfelder gesetzt
- Templates rendern ohne Fehler
- IDs und Aliasse kollidieren nicht

**Stufe B, Plausibilität**
- Zustandswerte passen zur Entität (z. B. `on`/`off`, Wertebereiche, Einheiten)
- Automation kann auslösen (Trigger nicht widersprüchlich zu Bedingungen)
- Dashboard-Karte passt zum Entitätstyp

**Stufe C, Konflikte mit dem Bestand**
- Gegenläufige Aktionen auf derselben Entität bei überlappenden Auslösern
- Auslöseketten und Zyklen zwischen Automationen
- Dubletten zu bestehenden Automationen

Stufe C arbeitet auf einer Zwischendarstellung (Auslöser, Bedingungen, gelesene und geschriebene Entitäten je Automation). Diese Darstellung ist so zu halten, dass sie sich später in Workflow-Netze überführen lässt.

## 6. Repo-Struktur

```
custom_components/blaupause/
  __init__.py  manifest.json  config_flow.py  const.py
  websocket.py  context.py  drafting.py  changeset.py
  apply.py  journal.py
  checks/  validity.py  plausibility.py  conflicts.py
  schemas/  automation.json  dashboard.json
  frontend/  (gebautes Bundle)
  translations/  de.json  en.json
frontend/  src/  package.json  (Lit, TypeScript, Vite oder Rollup)
tests/  conftest.py  fixtures/  test_*.py
eval/  cases/  run_eval.py
.devcontainer/  .github/workflows/  hacs.json  PLAN.md  README.md
```

## 7. Meilensteine

### M0 Gerüst
- Integration lädt, Config Flow mit Auswahl der Modellquelle
- Leeres Panel erscheint in der Seitenleiste
- Devcontainer mit frischer HA-Instanz und Beispielgeräten (Demo-Integration, Template-Entitäten)
- CI: `hassfest`, HACS-Validierung, `ruff`, `pytest`, Frontend-Build

Abnahme: Installation in der Dev-Instanz, Panel öffnet, CI grün.

### M1 Automationen, durchgängig
- Kontextaufbau und Ausschnittwahl
- Entwurf als Change Set über strukturierte Ausgabe
- Prüfungen der Stufe A mit Reparaturschleife
- Panel: Eingabe, Verlauf, Befunde, Diff, Übernehmen, Verwerfen
- Schnappschuss und Rückgängig
- Protokoll

Abnahme: „Schalte das Flurlicht bei Bewegung nach Sonnenuntergang für 3 Minuten ein“ führt zu einer gültigen Automation. Ein Entwurf mit erfundener Entität wird erkannt und repariert oder blockiert.

### M2 Bearbeiten und Erklären
- Bestehende Automationen ändern (Diff gegen Bestand)
- Automation in Klartext erklären
- Prüfungen der Stufe B

### M3 Dashboards
- Ansichten und Karten erzeugen und ändern
- Live-Vorschau im Panel
- Beschränkung auf Kernkarten, optionale Erkennung installierter Custom Cards

### M4 Konfliktanalyse
- Zwischendarstellung aller Automationen, auch der YAML-basierten
- Prüfungen der Stufe C
- Darstellung der Befunde mit Verweis auf die betroffenen Automationen

### M5 Härtung für lokale Modelle
- Eval-Lauf mit Ollama, Auswertung nach Modell
- Anpassung von Prompt, Ausschnittgröße und Schema
- HACS-Release

## 8. Tests und Evaluation

- **Unit-Tests** für Prüfungen und Zustandsautomat mit `pytest-homeassistant-custom-component`. Das Modell wird durch feste Antworten ersetzt.
- **Eval-Satz** in `eval/cases`: Anfrage, Ausgangskonfiguration, erwartete Eigenschaften des Ergebnisses. Start mit 30 Fällen, darunter Fälle mit absichtlich fehlender Entität und mit Konflikt.
- **Kennzahlen:** Anteil gültiger Entwürfe im ersten Versuch, nach Reparatur, Zahl der Runden, Laufzeit, erkannte Konflikte.

Der Eval-Satz entsteht ab M1 und wächst mit jedem Meilenstein.

## 9. Offene Entscheidungen

| Frage | Vorschlag |
|---|---|
| Name und Domain | vor M1 festlegen |
| Modell für die Entwicklung | Claude bis M4, Ollama als Härtetest in M5 |
| Modellanbindung | AI Task, falls strukturierte Ausgabe dort ausreicht, sonst eigener Client |
| Lizenz | MIT oder Apache-2.0 |
| Sprache | Oberfläche Deutsch und Englisch, Code und Doku Englisch |
| Skripte und Helfer | ab M2 als weitere Operationstypen |
| YAML-basierte Konfiguration schreiben | nicht geplant, nur lesen |

## 10. Risiken

- **HA-interne Schnittstellen ändern sich.** Zugriffe kapseln, Mindestversion in `manifest.json` und `hacs.json` festhalten.
- **Kontextgröße bei großen Installationen.** Ausschnittwahl früh testen, Obergrenzen einbauen.
- **Schreibrechte.** Panel und Kommandos nur für Administratoren. Kein Schreiben ohne Bestätigung, auch nicht über Dienste.
- **Datenabfluss an Cloud-Modelle.** Im Config Flow sichtbar machen, welche Daten an welches Modell gehen.

## 11. Auftrag für die erste Sitzung

1. `PLAN.md` lesen. Abschnitt 4 gegen die aktuelle HA-Entwicklerdokumentation prüfen und Abweichungen hier eintragen.
2. M0 umsetzen: Gerüst, Devcontainer, CI, leeres Panel.
3. Change-Set-Datenmodell und Zustandsautomat mit Tests anlegen.
4. Am Ende Stand und nächste Schritte in `PLAN.md` nachtragen.
