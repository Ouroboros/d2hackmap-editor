#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use encoding_rs::{GBK, UTF_16BE, UTF_16LE, UTF_8};
use serde::Serialize;
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use tauri::WebviewWindowBuilder;

const REQUIRED_FILE: &str = "d2hackmap.default.cfg";
const EDITOR_OUTPUT_FILE: &str = "d2hackmap.gen.cfg";
const DEBUG_LOG_FILE: &str = "d2hackmap-editor-debug.log";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigDirectory {
    path: String,
    name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ValidateResult {
    ok: bool,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChainNode {
    file: String,
    path: String,
    full_path: Option<String>,
    status: String,
    children: Vec<ChainNode>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigFileContent {
    name: String,
    path: String,
    lines: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
enum DetectedEncoding {
    Utf16Le,
    Utf16Be,
    Utf8,
    Gbk,
}

#[derive(Debug, Clone, Copy)]
struct DecodedFile {
    encoding: DetectedEncoding,
    has_bom: bool,
}

#[tauri::command]
fn pick_config_directory(start_dir: Option<String>) -> Result<Option<ConfigDirectory>, String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(start) = start_dir {
        if !start.is_empty() {
            dialog = dialog.set_directory(start);
        }
    }

    Ok(dialog.pick_folder().map(|path| directory_payload(&path)))
}

#[tauri::command]
fn validate_config_directory(path: String) -> Result<ValidateResult, String> {
    let dir = PathBuf::from(path);
    if !dir.is_dir() {
        return Ok(ValidateResult {
            ok: false,
            error: Some("no_required_file".to_string()),
        });
    }

    let required = dir.join(REQUIRED_FILE);
    if !required.is_file() {
        return Ok(ValidateResult {
            ok: false,
            error: Some("no_required_file".to_string()),
        });
    }

    match fs::File::open(required) {
        Ok(_) => Ok(ValidateResult {
            ok: true,
            error: None,
        }),
        Err(_) => Ok(ValidateResult {
            ok: false,
            error: Some("no_permission".to_string()),
        }),
    }
}

#[tauri::command]
fn parse_config_chain(root_path: String) -> Result<ChainNode, String> {
    let root_dir = PathBuf::from(root_path);
    let root_file = root_dir.join(REQUIRED_FILE);
    let root_canonical = root_dir.canonicalize().unwrap_or(root_dir.clone());
    let mut loaded = HashSet::new();

    parse_chain_node(
        &root_canonical,
        &root_file,
        REQUIRED_FILE.to_string(),
        &mut loaded,
    )
}

#[tauri::command]
fn read_config_file(path: String) -> Result<ConfigFileContent, String> {
    let file_path = PathBuf::from(path);
    let (text, _) = read_text_file(&file_path)?;
    let name = file_path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| file_path.to_string_lossy().into_owned());

    Ok(ConfigFileContent {
        name,
        path: path_to_string(&file_path),
        lines: split_lines(&text),
    })
}

#[tauri::command]
fn save_editor_output(root_path: String, content: String) -> Result<(), String> {
    let root_dir = PathBuf::from(root_path);
    if !root_dir.is_dir() {
        return Err("Config directory does not exist".to_string());
    }

    let output_path = root_dir.join(EDITOR_OUTPUT_FILE);
    write_utf16le_with_bom(&output_path, &content)?;
    ensure_editor_import(&root_dir)?;
    Ok(())
}

#[tauri::command]
fn append_debug_log(message: String) -> Result<String, String> {
    let log_path = debug_log_path().map_err(|e| format!("Failed to resolve debug log path: {e}"))?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("Failed to open debug log {}: {e}", log_path.display()))?;

    writeln!(file, "{message}")
        .map_err(|e| format!("Failed to write debug log {}: {e}", log_path.display()))?;

    Ok(path_to_string(&log_path))
}

fn directory_payload(path: &Path) -> ConfigDirectory {
    ConfigDirectory {
        path: path_to_string(path),
        name: path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string_lossy().into_owned()),
    }
}

fn parse_chain_node(
    root_dir: &Path,
    file_path: &Path,
    import_label: String,
    loaded: &mut HashSet<PathBuf>,
) -> Result<ChainNode, String> {
    let rendered_path = display_path(root_dir, file_path);

    if !file_path.is_file() {
        return Ok(ChainNode {
            file: import_label,
            path: rendered_path,
            full_path: None,
            status: "missing".to_string(),
            children: Vec::new(),
        });
    }

    let canonical = file_path.canonicalize().map_err(|e| {
        format!(
            "Failed to resolve config path {}: {}",
            file_path.display(),
            e
        )
    })?;

    if loaded.contains(&canonical) {
        return Ok(ChainNode {
            file: import_label,
            path: display_path(root_dir, &canonical),
            full_path: Some(path_to_string(&canonical)),
            status: "circular".to_string(),
            children: Vec::new(),
        });
    }
    loaded.insert(canonical.clone());

    let (content, _) = read_text_file(&canonical)?;
    let imports = parse_import_configs(&content);
    let current_dir = canonical.parent().unwrap_or(root_dir);
    let mut children = Vec::new();

    for import_path in imports {
        let child_path = resolve_import_path(current_dir, &import_path);
        children.push(parse_chain_node(
            root_dir,
            &child_path,
            import_path,
            loaded,
        )?);
    }

    Ok(ChainNode {
        file: canonical
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or(import_label),
        path: display_path(root_dir, &canonical),
        full_path: Some(path_to_string(&canonical)),
        status: "loaded".to_string(),
        children,
    })
}

fn resolve_import_path(base_dir: &Path, import_path: &str) -> PathBuf {
    let normalized = normalize_config_path(import_path);
    let path = PathBuf::from(normalized);
    if path.is_absolute() {
        path
    } else {
        base_dir.join(path)
    }
}

fn normalize_config_path(path: &str) -> String {
    path.replace('\\', std::path::MAIN_SEPARATOR_STR)
}

fn display_path(root_dir: &Path, path: &Path) -> String {
    let normalized = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    if let Ok(relative) = normalized.strip_prefix(root_dir) {
        path_to_string(relative)
    } else {
        path_to_string(&normalized)
    }
}

fn parse_import_configs(text: &str) -> Vec<String> {
    let mut imports = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") {
            continue;
        }

        let Some((key, rest)) = trimmed.split_once(':') else {
            continue;
        };
        if key.trim() != "Import Config" {
            continue;
        }

        let mut value = rest.trim();
        if let Some((before_comment, _)) = value.split_once("//") {
            value = before_comment.trim();
        }

        let unquoted = value
            .strip_prefix('"')
            .and_then(|s| s.strip_suffix('"'))
            .or_else(|| value.strip_prefix('\'').and_then(|s| s.strip_suffix('\'')))
            .unwrap_or(value)
            .trim();

        if !unquoted.is_empty() {
            imports.push(unquoted.to_string());
        }
    }

    imports
}

fn ensure_editor_import(root_dir: &Path) -> Result<(), String> {
    let default_path = root_dir.join(REQUIRED_FILE);
    let (mut default_lines, default_meta) = read_lines_with_meta(&default_path)?;

    if has_gen_import(&default_lines) {
        return Ok(());
    }

    let imports = import_config_values(&default_lines);
    if let Some(first_import) = imports.first() {
        let first_path = root_dir.join(normalize_config_path(first_import));
        if first_path.is_file() {
            let (mut first_lines, first_meta) = read_lines_with_meta(&first_path)?;
            if !has_gen_import(&first_lines) {
                insert_gen_import(&mut first_lines);
                write_lines_with_meta(&first_path, &first_lines, first_meta)?;
            }
            return Ok(());
        }
    }

    insert_gen_import(&mut default_lines);
    write_lines_with_meta(&default_path, &default_lines, default_meta)
}

fn read_lines_with_meta(path: &Path) -> Result<(Vec<String>, DecodedFile), String> {
    let (text, meta) = read_text_file(path)?;
    Ok((split_lines(&text), meta))
}

fn import_config_values(lines: &[String]) -> Vec<String> {
    let mut imports = Vec::new();
    for line in lines {
        let trimmed = line.trim();
        if trimmed.starts_with("//") || !trimmed.starts_with("Import Config:") {
            continue;
        }

        let mut value = trimmed["Import Config:".len()..].trim();
        if let Some((before_comment, _)) = value.split_once("//") {
            value = before_comment.trim();
        }

        let unquoted = value
            .strip_prefix('"')
            .and_then(|s| s.strip_suffix('"'))
            .or_else(|| value.strip_prefix('\'').and_then(|s| s.strip_suffix('\'')))
            .unwrap_or(value)
            .trim();

        if !unquoted.is_empty() {
            imports.push(unquoted.to_string());
        }
    }
    imports
}

fn has_gen_import(lines: &[String]) -> bool {
    lines.iter().any(|line| {
        let trimmed = line.trim();
        !trimmed.starts_with("//")
            && trimmed.starts_with("Import Config:")
            && trimmed.contains(EDITOR_OUTPUT_FILE)
    })
}

fn insert_gen_import(lines: &mut Vec<String>) {
    let import_line = format!("    Import Config: \"{}\"", EDITOR_OUTPUT_FILE);
    let last_import_index = lines.iter().rposition(|line| {
        let trimmed = line.trim();
        !trimmed.starts_with("//") && trimmed.starts_with("Import Config:")
    });

    match last_import_index {
        Some(index) => lines.insert(index + 1, import_line),
        None => lines.insert(0, import_line),
    }
}

fn read_text_file(path: &Path) -> Result<(String, DecodedFile), String> {
    let bytes = fs::read(path)
        .map_err(|e| format!("Failed to read config file {}: {}", path.display(), e))?;

    let (encoding, has_bom, body) = if bytes.starts_with(&[0xFF, 0xFE]) {
        (DetectedEncoding::Utf16Le, true, &bytes[2..])
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        (DetectedEncoding::Utf16Be, true, &bytes[2..])
    } else if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        (DetectedEncoding::Utf8, true, &bytes[3..])
    } else {
        (DetectedEncoding::Gbk, false, bytes.as_slice())
    };

    let text = match encoding {
        DetectedEncoding::Utf16Le => UTF_16LE.decode(body).0.into_owned(),
        DetectedEncoding::Utf16Be => UTF_16BE.decode(body).0.into_owned(),
        DetectedEncoding::Utf8 => UTF_8.decode(body).0.into_owned(),
        DetectedEncoding::Gbk => GBK.decode(body).0.into_owned(),
    };

    Ok((text, DecodedFile { encoding, has_bom }))
}

fn write_lines_with_meta(path: &Path, lines: &[String], meta: DecodedFile) -> Result<(), String> {
    let content = lines.join("\r\n");
    let bytes = match meta.encoding {
        DetectedEncoding::Utf16Le => encode_utf16(&content, true, meta.has_bom),
        DetectedEncoding::Utf16Be => encode_utf16(&content, false, meta.has_bom),
        DetectedEncoding::Utf8 => {
            let mut bytes = Vec::new();
            if meta.has_bom {
                bytes.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
            }
            bytes.extend_from_slice(content.as_bytes());
            bytes
        }
        DetectedEncoding::Gbk => GBK.encode(&content).0.into_owned(),
    };

    fs::write(path, bytes)
        .map_err(|e| format!("Failed to write config file {}: {}", path.display(), e))
}

fn write_utf16le_with_bom(path: &Path, content: &str) -> Result<(), String> {
    fs::write(path, encode_utf16(content, true, true))
        .map_err(|e| format!("Failed to write editor output {}: {}", path.display(), e))
}

fn encode_utf16(content: &str, little_endian: bool, with_bom: bool) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(content.len() * 2 + 2);
    if with_bom {
        if little_endian {
            bytes.extend_from_slice(&[0xFF, 0xFE]);
        } else {
            bytes.extend_from_slice(&[0xFE, 0xFF]);
        }
    }

    for unit in content.encode_utf16() {
        let pair = if little_endian {
            unit.to_le_bytes()
        } else {
            unit.to_be_bytes()
        };
        bytes.extend_from_slice(&pair);
    }

    bytes
}

fn split_lines(text: &str) -> Vec<String> {
    text.split('\n')
        .map(|line| line.strip_suffix('\r').unwrap_or(line).to_string())
        .collect()
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn debug_log_path() -> Result<PathBuf, std::io::Error> {
    let exe_path = std::env::current_exe()?;
    let exe_dir = exe_path.parent().unwrap_or(Path::new("."));
    Ok(exe_dir.join(DEBUG_LOG_FILE))
}

fn exe_webview_data_dir() -> Result<PathBuf, std::io::Error> {
    let exe_path = std::env::current_exe()?;
    let exe_dir = exe_path.parent().unwrap_or(Path::new("."));
    Ok(exe_dir.join("webview-data"))
}

fn create_main_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let Some(mut window_config) = app.config().app.windows.first().cloned() else {
        return Ok(());
    };

    if let Some(monitor) = app.primary_monitor()? {
        let work_area = monitor.work_area();
        let scale_factor = monitor.scale_factor();
        let target_width = ((work_area.size.width as f64) * 0.85 / scale_factor).round();
        let target_height = ((work_area.size.height as f64) * 0.85 / scale_factor).round();

        window_config.width = target_width;
        window_config.height = target_height;
        window_config.center = true;
        window_config.x = None;
        window_config.y = None;
    }

    WebviewWindowBuilder::from_config(app, &window_config)?
        .data_directory(exe_webview_data_dir()?)
        .build()?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            create_main_window(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_config_directory,
            validate_config_directory,
            parse_config_chain,
            read_config_file,
            save_editor_output,
            append_debug_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
