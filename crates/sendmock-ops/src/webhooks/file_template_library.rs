//! Templates from `--templates-dir`: TOML files in the export format, held in memory and
//! replaced whenever the directory changes. They are read-only in SendMock; edit the files.

use std::path::Path;
use std::sync::{Arc, RwLock};

use super::template_file::parse_template_file;
use super::template_view::{
    ResolvedTemplate, TemplateCategory, TemplateSource, WebhookTemplateSummary,
};

/// The file templates loaded now, shared by every request.
#[derive(Clone, Default)]
pub struct FileTemplateLibrary {
    templates: Arc<RwLock<Vec<ResolvedTemplate>>>,
}

impl FileTemplateLibrary {
    pub fn replace_templates(&self, file_templates: Vec<ResolvedTemplate>) {
        if let Ok(mut templates) = self.templates.write() {
            *templates = file_templates;
        }
    }

    pub fn list_templates(&self) -> Vec<ResolvedTemplate> {
        self.templates
            .read()
            .map(|templates| templates.clone())
            .unwrap_or_default()
    }

    pub fn find_template(&self, template_id: &str) -> Option<ResolvedTemplate> {
        self.list_templates()
            .into_iter()
            .find(|file_template| file_template.summary.id == template_id)
    }
}

/// A template file loaded, or the reason it was skipped.
pub struct LoadedTemplateDirectory {
    pub templates: Vec<ResolvedTemplate>,
    pub problems: Vec<String>,
}

/// Every `*.toml` file in the directory, by file name; a file without an `id` takes
/// `file.<file stem>`, and a file that does not parse is reported and skipped.
pub fn load_template_directory(directory: &Path) -> LoadedTemplateDirectory {
    let mut loaded = LoadedTemplateDirectory {
        templates: Vec::new(),
        problems: Vec::new(),
    };
    let mut file_paths: Vec<_> = match std::fs::read_dir(directory) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|file_path| {
                file_path
                    .extension()
                    .is_some_and(|extension| extension == "toml")
            })
            .collect(),
        Err(read_error) => {
            loaded
                .problems
                .push(format!("{}: {read_error}", directory.display()));
            return loaded;
        }
    };
    file_paths.sort();
    for file_path in file_paths {
        match read_template_file(&file_path) {
            Ok(file_template) => loaded.templates.push(file_template),
            Err(problem) => loaded
                .problems
                .push(format!("{}: {problem}", file_path.display())),
        }
    }
    loaded
}

fn read_template_file(file_path: &Path) -> Result<ResolvedTemplate, String> {
    let file_text =
        std::fs::read_to_string(file_path).map_err(|read_error| read_error.to_string())?;
    let template_file = parse_template_file(&file_text)?;
    let file_stem = file_path
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(ResolvedTemplate {
        summary: WebhookTemplateSummary {
            id: template_file
                .template_id
                .unwrap_or_else(|| format!("file.{file_stem}")),
            name: template_file.name,
            service: template_file.service,
            category: TemplateCategory::Custom,
            source: TemplateSource::File,
            events: template_file.events,
            description: format!("From {}", file_path.display()),
            required_variables: template_file.required_variables,
            revision: 1,
            is_modified: false,
        },
        draft: template_file.draft,
        doc_url: None,
        verified_on: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const ORDER_TEMPLATE_TOML: &str = r#"id = "file.orders"
name = "Order hook"
service = "Shop"
events = ["email.received"]

[request]
method = "POST"
content_type = "application/json"
body = '{"subject": "{{ data.subject }}"}'
"#;

    // AC: WH-09.4
    #[test]
    fn loads_every_toml_template_and_reports_the_broken_ones() -> std::io::Result<()> {
        let directory = tempfile::tempdir()?;
        std::fs::write(directory.path().join("orders.toml"), ORDER_TEMPLATE_TOML)?;
        std::fs::write(
            directory.path().join("plain.toml"),
            ORDER_TEMPLATE_TOML.replace("id = \"file.orders\"\n", ""),
        )?;
        std::fs::write(
            directory.path().join("broken.toml"),
            "name = \"No request\"",
        )?;
        std::fs::write(directory.path().join("notes.txt"), "not a template")?;

        let loaded = load_template_directory(directory.path());

        let template_ids: Vec<&str> = loaded
            .templates
            .iter()
            .map(|file_template| file_template.summary.id.as_str())
            .collect();
        assert_eq!(template_ids, vec!["file.orders", "file.plain"]);
        assert_eq!(loaded.templates[0].summary.source, TemplateSource::File);
        assert_eq!(loaded.problems.len(), 1);
        assert!(loaded.problems[0].contains("broken.toml"));
        Ok(())
    }

    #[test]
    fn a_missing_directory_is_a_problem_not_a_crash() {
        let loaded = load_template_directory(Path::new("/no/such/sendmock/templates"));

        assert!(loaded.templates.is_empty());
        assert_eq!(loaded.problems.len(), 1);
    }
}
