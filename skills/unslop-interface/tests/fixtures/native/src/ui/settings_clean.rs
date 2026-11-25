use eframe::egui;

pub fn show(app: &mut App, ui: &mut egui::Ui) {
    egui::Frame::group(ui.style()).show(ui, |ui| {
        ui.set_min_width(ui.available_width());
        egui::Grid::new("general").num_columns(2).show(ui, |ui| {
            ui.label("Idioma");
            egui::ComboBox::from_id_salt("lang")
                .selected_text(app.lang.name())
                .show_ui(ui, |ui| {
                    for lang in Lang::ALL {
                        ui.selectable_value(&mut app.lang, lang, lang.name());
                    }
                });
            ui.end_row();
        });
    });
}
