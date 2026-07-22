//! Adapter: converts the Raspberry Pi Imager `os_list` JSON catalog into the
//! same `ApiVendor` / `ApiBoardSummary` / `ApiImage` shapes the rest of the
//! app already consumes from api.armbian.com. This lets Raspberry Pi OS (and
//! any other distro listed in the official RPi catalog) appear as a regular
//! "vendor" in the Manufacturer -> Board -> Image wizard.
//!
//! Schema verified 2026-07-22 against a live download of
//! os_list_imagingutility_v4.json. Notable, non-obvious facts baked into
//! this module:
//!
//! - The root JSON has an `imager.devices[]` section that is the *official*
//!   list of Raspberry Pi hardware families, each with a `tags[]` array of
//!   the device codes (e.g. "pi5-64bit") that belong to it. We use this
//!   directly instead of a hand-maintained table, so new Pi models/tags
//!   picked up by upstream are picked up here automatically. One synthetic
//!   `tags: []` entry ("No filtering") exists and is intentionally skipped
//!   — including it would create a single board matching every image.
//! - The catalog is NOT Raspberry-Pi-exclusive: some third-party OS entries
//!   (e.g. Mainsail OS, Falcon Player) also declare device codes for Orange
//!   Pi / BeagleBone boards. Since we only build boards from the official
//!   `imager.devices` families (all Pi-only), those foreign device codes
//!   simply never match anything here and are silently excluded. Revisit if
//!   we ever want to cross-reference them against Armbian's own Orange
//!   Pi/BeagleBone boards instead of dropping them.
//! - Leaf image entries carry `extract_sha256` inline; Armbian's `ApiImage`
//!   expects a `sha_url` that download.rs fetches and parses as a
//!   `sha256sum`-style text file. We don't have a hosting endpoint for that
//!   yet, so `sha_url` is left `None` for RPi images (skips the
//!   pre-download hash check). Integrity is still covered by the app's own
//!   post-write read-back verification (the `verify` flag in the flash
//!   step), which never touches `sha_url`. TODO: stand up a tiny static
//!   proxy that re-serves `extract_sha256` as a `sha256sum`-formatted text
//!   file so pre-download verification works the same as for native
//!   Armbian images.
//! - `subitems_url` (remote category files) doesn't appear anywhere in the
//!   live v4 catalog we inspected, but the schema still allows it — we
//!   follow it defensively, capped at `MAX_SUBITEM_DEPTH`, in case upstream
//!   starts using it again.

use serde::Deserialize;

use crate::images::models::{ApiBoardSummary, ApiDownloadInfo, ApiImage, ApiVendor};
use crate::{log_debug, log_warn};

const RPI_VENDOR_SLUG: &str = "raspberrypi";
const RPI_OS_LIST_URL: &str = "https://downloads.raspberrypi.org/os_list_imagingutility_v4.json";
const MAX_SUBITEM_DEPTH: u8 = 4;

// ─── Raw JSON shapes (only fields we use are declared) ──────────────────────

#[derive(Debug, Clone, Deserialize)]
struct RpiOsListRoot {
    #[serde(default)]
    imager: Option<RpiImagerSection>,
    #[serde(default)]
    os_list: Vec<RpiOsEntry>,
}

#[derive(Debug, Clone, Deserialize)]
struct RpiImagerSection {
    #[serde(default)]
    devices: Vec<RpiDeviceFamily>,
}

/// One hardware family from `imager.devices[]`, e.g. "Raspberry Pi 5" with
/// tags `["pi5-64bit", "pi5-32bit"]`. This is the authoritative source for
/// which device codes belong together — we don't guess at it ourselves.
#[derive(Debug, Clone, Deserialize)]
struct RpiDeviceFamily {
    name: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    description: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct RpiOsEntry {
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    image_download_size: Option<u64>,
    #[serde(default)]
    release_date: Option<String>,
    #[serde(default)]
    devices: Option<Vec<String>>,
    #[serde(default)]
    subitems_url: Option<String>,
    #[serde(default)]
    subitems: Option<Vec<RpiOsEntry>>,
}

// ─── Internal flattened shapes ───────────────────────────────────────────────

/// A flattened, "leaf" OS entry (an actual flashable image, not a category).
struct FlatEntry {
    name: String,
    description: String,
    url: String,
    image_download_size: u64,
    release_date: String,
    devices: Vec<String>,
}

/// A resolved board: family metadata + every device code it matches.
struct FamilyBoard {
    slug: String,
    name: String,
    description: Option<String>,
    tags: Vec<String>,
}

/// The whole catalog, fetched once and reused by both the boards and images
/// entry points so we don't hit the network twice per user action.
struct Catalog {
    families: Vec<FamilyBoard>,
    entries: Vec<FlatEntry>,
}

/// Turn a human name like "Raspberry Pi 5" into a stable slug like
/// "raspberry-pi-5", matching the style Armbian's own board slugs use.
fn slugify(name: &str) -> String {
    let mut slug = String::with_capacity(name.len());
    let mut prev_dash = false;
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash && !slug.is_empty() {
            slug.push('-');
            prev_dash = true;
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    slug
}

/// Synthetic vendor entry representing the Raspberry Pi Foundation catalog.
pub fn rpi_vendor() -> ApiVendor {
    ApiVendor {
        slug: RPI_VENDOR_SLUG.to_string(),
        name: "Raspberry Pi (OS catalog)".to_string(),
        logo_url: None,
        website: Some("https://www.raspberrypi.com/software/".to_string()),
        description: Some(
            "Official Raspberry Pi OS images, imported live from the Raspberry Pi Imager catalog."
                .to_string(),
        ),
        board_count: 0, // not load-bearing here; boards are computed separately
        partner_tier: None,
    }
}

/// Fetch and flatten the RPi os_list catalog + its device-family index.
async fn fetch_catalog(client: &reqwest::Client) -> Result<Catalog, String> {
    log_debug!("rpi_source", "Fetching RPi OS catalog: {}", RPI_OS_LIST_URL);
    let root: RpiOsListRoot = client
        .get(RPI_OS_LIST_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch RPi OS catalog: {}", e))?
        .error_for_status()
        .map_err(|e| format!("RPi OS catalog returned error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse RPi OS catalog: {}", e))?;

    let families: Vec<FamilyBoard> = root
        .imager
        .map(|i| i.devices)
        .unwrap_or_default()
        .into_iter()
        // Skip the catch-all "No filtering" family (empty tags matches everything).
        .filter(|f| !f.tags.is_empty())
        .map(|f| FamilyBoard {
            slug: slugify(&f.name),
            name: f.name,
            description: f.description,
            tags: f.tags,
        })
        .collect();

    if families.is_empty() {
        log_warn!(
            "rpi_source",
            "RPi catalog had no imager.devices families; no boards will be created"
        );
    }

    let mut entries = Vec::new();
    for entry in root.os_list {
        flatten_entry(client, entry, 0, &mut entries).await;
    }

    Ok(Catalog { families, entries })
}

fn flatten_entry<'a>(
    client: &'a reqwest::Client,
    entry: RpiOsEntry,
    depth: u8,
    out: &'a mut Vec<FlatEntry>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'a>> {
    Box::pin(async move {
        // Leaf: has a direct download URL + device compatibility list.
        if let (Some(url), Some(devices)) = (entry.url.clone(), entry.devices.clone()) {
            out.push(FlatEntry {
                name: entry.name.clone(),
                description: entry.description.clone(),
                url,
                image_download_size: entry.image_download_size.unwrap_or(0),
                release_date: entry.release_date.clone().unwrap_or_default(),
                devices,
            });
            return;
        }

        // Inline category: recurse into subitems directly.
        if let Some(subitems) = entry.subitems {
            for sub in subitems {
                flatten_entry(client, sub, depth, out).await;
            }
            return;
        }

        // Remote category: not seen in the live v4 catalog as of 2026-07-22,
        // but the schema allows it, so we follow it defensively (depth-capped).
        if let Some(sub_url) = entry.subitems_url {
            if depth >= MAX_SUBITEM_DEPTH {
                log_warn!("rpi_source", "Max subitem recursion depth reached at {}", sub_url);
                return;
            }
            match fetch_remote_subitems(client, &sub_url).await {
                Ok(sub_entries) => {
                    for sub in sub_entries {
                        flatten_entry(client, sub, depth + 1, out).await;
                    }
                }
                Err(e) => log_warn!("rpi_source", "Failed to fetch subitems {}: {}", sub_url, e),
            }
        }
    })
}

async fn fetch_remote_subitems(
    client: &reqwest::Client,
    url: &str,
) -> Result<Vec<RpiOsEntry>, String> {
    #[derive(Deserialize)]
    struct SubList {
        #[serde(default)]
        os_list: Vec<RpiOsEntry>,
    }
    let list: SubList = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(list.os_list)
}

/// Fan the flattened catalog out into one synthetic `ApiBoardSummary` per
/// official Raspberry Pi hardware family.
pub async fn fetch_rpi_boards(client: &reqwest::Client) -> Result<Vec<ApiBoardSummary>, String> {
    let catalog = fetch_catalog(client).await?;

    let boards = catalog
        .families
        .iter()
        .map(|family| {
            let matching: Vec<&FlatEntry> = catalog
                .entries
                .iter()
                .filter(|e| e.devices.iter().any(|d| family.tags.contains(d)))
                .collect();

            let has_desktop = matching.iter().any(|e| {
                e.name.to_lowercase().contains("desktop")
                    || !e.description.to_lowercase().contains("lite")
            });

            ApiBoardSummary {
                slug: family.slug.clone(),
                name: family.name.clone(),
                vendor_slug: RPI_VENDOR_SLUG.to_string(),
                vendor_name: "Raspberry Pi (OS catalog)".to_string(),
                // Reuses an existing tier bucket so the UI's badge component
                // (BoardBadges.tsx) renders something sensible without
                // needing a brand-new tier just for this synthetic vendor.
                support_tier: "eos".to_string(),
                image_count: matching.len() as u32,
                has_desktop,
                promoted: false,
                image_url: None,
                soc: None,
                architecture: Some("arm64".to_string()),
                summary: family.description.clone(),
                qdl: None,
            }
        })
        .filter(|b| b.image_count > 0)
        .collect();

    Ok(boards)
}

/// True when a board slug belongs to the synthetic RPi catalog rather than
/// the real Armbian REST API. Cheap slug-shape check (all our slugs start
/// with "raspberry-pi") so callers can route without a network round trip.
pub fn is_rpi_board_slug(slug: &str) -> bool {
    slug.starts_with("raspberry-pi")
}

/// Fetch images for one synthetic RPi board slug (e.g. "raspberry-pi-5").
pub async fn fetch_rpi_images_for_board(
    client: &reqwest::Client,
    board_slug: &str,
) -> Result<Vec<ApiImage>, String> {
    let catalog = fetch_catalog(client).await?;

    let family = catalog
        .families
        .iter()
        .find(|f| f.slug == board_slug)
        .ok_or_else(|| format!("Unknown RPi board slug: {}", board_slug))?;

    let images = catalog
        .entries
        .into_iter()
        .filter(|e| e.devices.iter().any(|d| family.tags.contains(d)))
        .enumerate()
        .map(|(i, entry)| ApiImage {
            id: format!("rpi-{}-{}", board_slug, i),
            board_slug: board_slug.to_string(),
            variant: "default".to_string(),
            distribution: "raspberrypios".to_string(),
            release: entry.release_date.clone(),
            kernel_branch: "n/a".to_string(),
            kernel_version: "n/a".to_string(),
            application: Some(entry.name.clone()),
            promoted: false,
            stability: "stable".to_string(),
            format: "sd".to_string(),
            storage: None,
            companions: Vec::new(),
            display_variants: Vec::new(),
            download: ApiDownloadInfo {
                file_url: entry.url.clone(),
                direct_url: entry.url,
                // See module docs: intentionally None until we host a
                // sha256sum-formatted proxy for RPi's inline extract_sha256.
                sha_url: None,
                asc_url: None,
                torrent_url: None,
                size_bytes: entry.image_download_size,
                updated_at: Some(entry.release_date),
            },
        })
        .collect();

    Ok(images)
}
