use eframe::egui;

use crate::i18n::{t, Lang};
use crate::state::{App, DeviceKind};

pub fn show(app: &mut App, ui: &mut egui::Ui) {
    ui.heading(t("settings.title"));

    ui.group(|ui| {
        ui.label(egui::RichText::new("Dispositivo").strong());
        ui.small("Qual deck o MultiDeck controla. Trocar reinicia a conexão.");
        ui.horizontal(|ui| {
            ui.selectable_value(&mut app.device, DeviceKind::Mobile, "Stream Deck Mobile");
            ui.selectable_value(&mut app.device, DeviceKind::Virtual, "Deck virtual");
            ui.selectable_value(&mut app.device, DeviceKind::Usb, "Deck USB");
        });
    });

    ui.group(|ui| {
        ui.label(egui::RichText::new("Idioma").strong());
        ui.horizontal(|ui| {
            ui.selectable_value(&mut app.lang, Lang::En, "English");
            ui.selectable_value(&mut app.lang, Lang::PtBr, "Português (Brasil)");
        });
    });

    egui::Frame::group(ui.style()).show(ui, |ui| {
        ui.label(egui::RichText::new("Stream Deck Mobile").strong());
        if ui.button("Parear um celular").clicked() {
            app.pairing = true;
        }
    });

    ui.group(|ui| {
        ui.label("Sobre");
        ui.small("Dispositivos entram por adaptadores. Adaptadores USB e Stream Deck Mobile chegam em um marco posterior.");
    });
}
