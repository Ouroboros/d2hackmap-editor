#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

use encoding_rs::{GBK, UTF_16BE, UTF_16LE, UTF_8};
use serde::Serialize;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use tauri::WebviewWindowBuilder;

const REQUIRED_FILE: &str = "d2hackmap.default.cfg";
const EDITOR_OUTPUT_FILE: &str = "d2hackmap.gen.cfg";
const ACTIVE_PROFILE_FILE: &str = "d2hackmap.editor.profile.cfg";
const USER_DEFINED_FILE: &str = "d2hackmap.editor.user.cfg";
const PROFILE_DIR: &str = "profiles";
const DEBUG_LOG_FILE: &str = "d2hackmap-editor-debug.log";
const EXTERNAL_ISC_FILE: &str = "isc.json";
const EXTERNAL_SKILLS_FILE: &str = "skills.json";

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
struct ResolvedConfigPath {
    file: String,
    path: String,
    full_path: Option<String>,
    status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigFileContent {
    name: String,
    path: String,
    lines: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProfileScaffoldResult {
    entry_path: String,
    active_profile_path: String,
    user_defined_path: String,
    previous_entry_content: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProfileFile {
    file: String,
    path: String,
}

#[derive(Debug, Clone, Copy)]
enum DetectedEncoding {
    Utf16Le,
    Utf16Be,
    Utf8,
    Gbk,
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
fn read_config_file(path: String) -> Result<ConfigFileContent, String> {
    let file_path = PathBuf::from(path);
    let text = read_text_file(&file_path)?;
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
fn write_config_file(path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(path);
    let (encoding, with_bom) = detect_text_encoding(&file_path)?;
    fs::write(&file_path, encode_text(&content, encoding, with_bom))
        .map_err(|e| format!("Failed to write config file {}: {}", file_path.display(), e))
}

#[tauri::command]
fn resolve_config_path(
    root_path: String,
    base_file_path: String,
    import_path: String,
) -> Result<ResolvedConfigPath, String> {
    let root_input = PathBuf::from(root_path);
    let root_dir = root_input.canonicalize().unwrap_or(root_input);
    let base_file = PathBuf::from(base_file_path);
    let base_dir = base_file.parent().unwrap_or(root_dir.as_path());
    let resolved = resolve_import_path(base_dir, &import_path);
    let rendered_path = display_path(&root_dir, &resolved);

    if !resolved.is_file() {
        return Ok(ResolvedConfigPath {
            file: import_path,
            path: rendered_path,
            full_path: None,
            status: "missing".to_string(),
        });
    }

    let canonical = resolved.canonicalize().map_err(|e| {
        format!(
            "Failed to resolve config path {}: {}",
            resolved.display(),
            e
        )
    })?;

    Ok(ResolvedConfigPath {
        file: canonical
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| import_path.clone()),
        path: display_path(&root_dir, &canonical),
        full_path: Some(path_to_string(&canonical)),
        status: "loaded".to_string(),
    })
}

#[tauri::command]
fn ensure_profile_scaffold(
    root_path: String,
    entry_content: String,
    initial_profile_content: String,
    initial_user_content: String,
) -> Result<ProfileScaffoldResult, String> {
    let root_dir = PathBuf::from(root_path);
    if !root_dir.is_dir() {
        return Err("Config directory does not exist".to_string());
    }

    let entry_path = root_dir.join(EDITOR_OUTPUT_FILE);
    let active_profile_path = root_dir.join(ACTIVE_PROFILE_FILE);
    let user_defined_path = root_dir.join(USER_DEFINED_FILE);

    fs::create_dir_all(
        editor_profile_dir().map_err(|e| format!("Failed to resolve profile dir: {e}"))?,
    )
    .map_err(|e| format!("Failed to create editor profile dir: {e}"))?;

    let previous_entry_content = if entry_path.is_file() {
        let entry_text = read_text_file(&entry_path)?;
        Some(entry_text)
    } else {
        None
    };

    write_utf16le_with_bom(&entry_path, &entry_content)?;

    if !active_profile_path.is_file() {
        write_utf16le_with_bom(&active_profile_path, &initial_profile_content)?;
    }

    if !user_defined_path.is_file() {
        write_utf16le_with_bom(&user_defined_path, &initial_user_content)?;
    }

    Ok(ProfileScaffoldResult {
        entry_path: path_to_string(&entry_path),
        active_profile_path: path_to_string(&active_profile_path),
        user_defined_path: path_to_string(&user_defined_path),
        previous_entry_content,
    })
}

#[tauri::command]
fn save_profile_layers(
    root_path: String,
    entry_content: String,
    profile_content: String,
    user_content: String,
) -> Result<(), String> {
    let root_dir = PathBuf::from(root_path);
    if !root_dir.is_dir() {
        return Err("Config directory does not exist".to_string());
    }

    write_utf16le_with_bom(&root_dir.join(EDITOR_OUTPUT_FILE), &entry_content)?;
    write_utf16le_with_bom(&root_dir.join(ACTIVE_PROFILE_FILE), &profile_content)?;
    write_utf16le_with_bom(&root_dir.join(USER_DEFINED_FILE), &user_content)?;
    Ok(())
}

#[tauri::command]
fn list_editor_profiles() -> Result<Vec<ProfileFile>, String> {
    let profile_dir =
        editor_profile_dir().map_err(|e| format!("Failed to resolve profile dir: {e}"))?;
    if !profile_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut profiles = Vec::new();
    for entry in fs::read_dir(&profile_dir)
        .map_err(|e| format!("Failed to read profile dir {}: {e}", profile_dir.display()))?
    {
        let entry = entry.map_err(|e| format!("Failed to read profile entry: {e}"))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|s| s.to_str()) != Some("cfg") {
            continue;
        }

        let file = path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();

        profiles.push(ProfileFile {
            file,
            path: path_to_string(&path),
        });
    }

    profiles.sort_by(|a, b| a.file.cmp(&b.file));
    Ok(profiles)
}

#[tauri::command]
fn switch_editor_profile(root_path: String, profile_file: String) -> Result<(), String> {
    let root_dir = PathBuf::from(root_path);
    if !root_dir.is_dir() {
        return Err("Config directory does not exist".to_string());
    }

    let profile_dir =
        editor_profile_dir().map_err(|e| format!("Failed to resolve profile dir: {e}"))?;
    let source = safe_profile_path(&profile_dir, &profile_file)?;
    if !source.is_file() {
        return Err(format!("Profile does not exist: {}", source.display()));
    }

    fs::copy(&source, root_dir.join(ACTIVE_PROFILE_FILE))
        .map_err(|e| format!("Failed to switch profile {}: {e}", source.display()))?;
    Ok(())
}

#[tauri::command]
fn delete_editor_profile(profile_file: String) -> Result<(), String> {
    let profile_dir =
        editor_profile_dir().map_err(|e| format!("Failed to resolve profile dir: {e}"))?;
    let profile_path = safe_profile_path(&profile_dir, &profile_file)?;
    if !profile_path.is_file() {
        return Err(format!(
            "Profile does not exist: {}",
            profile_path.display()
        ));
    }

    fs::remove_file(&profile_path)
        .map_err(|e| format!("Failed to delete profile {}: {e}", profile_path.display()))?;
    Ok(())
}

#[tauri::command]
fn save_active_profile_to_library(
    root_path: String,
    profile_file: String,
) -> Result<ProfileFile, String> {
    let root_dir = PathBuf::from(root_path);
    if !root_dir.is_dir() {
        return Err("Config directory does not exist".to_string());
    }

    let source = root_dir.join(ACTIVE_PROFILE_FILE);
    if !source.is_file() {
        return Err(format!(
            "Active profile does not exist: {}",
            source.display()
        ));
    }

    let profile_dir =
        editor_profile_dir().map_err(|e| format!("Failed to resolve profile dir: {e}"))?;
    fs::create_dir_all(&profile_dir).map_err(|e| {
        format!(
            "Failed to create profile dir {}: {e}",
            profile_dir.display()
        )
    })?;

    let target = safe_profile_path(&profile_dir, &profile_file)?;
    fs::copy(&source, &target).map_err(|e| {
        format!(
            "Failed to save active profile {} to {}: {e}",
            source.display(),
            target.display()
        )
    })?;

    Ok(ProfileFile {
        file: profile_file,
        path: path_to_string(&target),
    })
}

#[tauri::command]
fn append_debug_log(message: String) -> Result<String, String> {
    let log_path =
        debug_log_path().map_err(|e| format!("Failed to resolve debug log path: {e}"))?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("Failed to open debug log {}: {e}", log_path.display()))?;

    writeln!(file, "{message}")
        .map_err(|e| format!("Failed to write debug log {}: {e}", log_path.display()))?;

    Ok(path_to_string(&log_path))
}

#[tauri::command]
fn read_external_isc_json() -> Result<Option<String>, String> {
    let isc_path = exe_sibling_path(EXTERNAL_ISC_FILE)
        .map_err(|e| format!("Failed to resolve {EXTERNAL_ISC_FILE} path: {e}"))?;

    if !isc_path.is_file() {
        return Ok(None);
    }

    fs::read_to_string(&isc_path)
        .map(Some)
        .map_err(|e| format!("Failed to read {}: {e}", isc_path.display()))
}

#[tauri::command]
fn read_external_skills_json() -> Result<Option<String>, String> {
    let skills_path = exe_sibling_path(EXTERNAL_SKILLS_FILE)
        .map_err(|e| format!("Failed to resolve {EXTERNAL_SKILLS_FILE} path: {e}"))?;

    if !skills_path.is_file() {
        return Ok(None);
    }

    fs::read_to_string(&skills_path)
        .map(Some)
        .map_err(|e| format!("Failed to read {}: {e}", skills_path.display()))
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

fn safe_profile_path(profile_dir: &Path, profile_file: &str) -> Result<PathBuf, String> {
    let requested = PathBuf::from(profile_file);
    if requested.components().count() != 1 {
        return Err("Invalid profile file name".to_string());
    }
    Ok(profile_dir.join(requested))
}

fn read_text_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path)
        .map_err(|e| format!("Failed to read config file {}: {}", path.display(), e))?;

    let (encoding, with_bom) = detect_encoding_from_bytes(&bytes);
    let body = if with_bom { strip_bom(&bytes, encoding) } else { bytes.as_slice() };

    let text = match encoding {
        DetectedEncoding::Utf16Le => UTF_16LE.decode(body).0.into_owned(),
        DetectedEncoding::Utf16Be => UTF_16BE.decode(body).0.into_owned(),
        DetectedEncoding::Utf8 => UTF_8.decode(body).0.into_owned(),
        DetectedEncoding::Gbk => GBK.decode(body).0.into_owned(),
    };

    Ok(text)
}

fn detect_text_encoding(path: &Path) -> Result<(DetectedEncoding, bool), String> {
    let bytes = fs::read(path)
        .map_err(|e| format!("Failed to read config file {}: {}", path.display(), e))?;
    Ok(detect_encoding_from_bytes(&bytes))
}

fn detect_encoding_from_bytes(bytes: &[u8]) -> (DetectedEncoding, bool) {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        (DetectedEncoding::Utf16Le, true)
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        (DetectedEncoding::Utf16Be, true)
    } else if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        (DetectedEncoding::Utf8, true)
    } else {
        (DetectedEncoding::Gbk, false)
    }
}

fn strip_bom(bytes: &[u8], encoding: DetectedEncoding) -> &[u8] {
    match encoding {
        DetectedEncoding::Utf16Le | DetectedEncoding::Utf16Be => &bytes[2..],
        DetectedEncoding::Utf8 => &bytes[3..],
        DetectedEncoding::Gbk => bytes,
    }
}

fn encode_text(content: &str, encoding: DetectedEncoding, with_bom: bool) -> Vec<u8> {
    match encoding {
        DetectedEncoding::Utf16Le => encode_utf16(content, true, with_bom),
        DetectedEncoding::Utf16Be => encode_utf16(content, false, with_bom),
        DetectedEncoding::Utf8 => {
            let mut bytes = Vec::new();
            if with_bom {
                bytes.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
            }
            bytes.extend_from_slice(UTF_8.encode(content).0.as_ref());
            bytes
        }
        DetectedEncoding::Gbk => GBK.encode(content).0.into_owned(),
    }
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
    exe_sibling_path(DEBUG_LOG_FILE)
}

fn exe_webview_data_dir() -> Result<PathBuf, std::io::Error> {
    exe_sibling_path("d2hackmap-cfg-editor-data")
}

fn editor_profile_dir() -> Result<PathBuf, std::io::Error> {
    Ok(exe_webview_data_dir()?.join(PROFILE_DIR))
}

fn exe_sibling_path(name: &str) -> Result<PathBuf, std::io::Error> {
    let exe_path = std::env::current_exe()?;
    let exe_dir = exe_path.parent().unwrap_or(Path::new("."));
    Ok(exe_dir.join(name))
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
            read_config_file,
            write_config_file,
            resolve_config_path,
            ensure_profile_scaffold,
            save_profile_layers,
            list_editor_profiles,
            switch_editor_profile,
            delete_editor_profile,
            save_active_profile_to_library,
            append_debug_log,
            read_external_isc_json,
            read_external_skills_json
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
