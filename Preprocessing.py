import os
import json
from pathlib import Path

import pandas as pd

# ============================================================
# CONFIG
# ============================================================

# Root folder containing:
# February_10
# February_11
# etc...

INPUT_ROOT = r"C:\Users\kale_p\Documents\LILA_GAME"

# Output folder
OUTPUT_ROOT = os.path.join(INPUT_ROOT, "processed_output")

# Supported file types
SUPPORTED_EXTENSIONS = [
    ".parquet",
]

# ============================================================
# MAP CONFIG
# ============================================================

# Adjust these if your game uses different bounds

WORLD_MIN_X = -12000
WORLD_MAX_X = 12000

WORLD_MIN_Y = -12000
WORLD_MAX_Y = 12000

MAP_WIDTH = 1024
MAP_HEIGHT = 1024

# ============================================================
# HELPERS
# ============================================================

def world_to_pixel(x, y):
    """
    Convert world coordinates to minimap pixel coordinates
    """

    px = int(
        ((x - WORLD_MIN_X) / (WORLD_MAX_X - WORLD_MIN_X))
        * MAP_WIDTH
    )

    py = int(
        ((WORLD_MAX_Y - y) / (WORLD_MAX_Y - WORLD_MIN_Y))
        * MAP_HEIGHT
    )

    px = max(0, min(MAP_WIDTH - 1, px))
    py = max(0, min(MAP_HEIGHT - 1, py))

    return px, py


def safe_value(v):
    """
    Convert pandas/numpy values into JSON-safe values
    """

    # Nulls
    if pd.isna(v):
        return None

    # Pandas timestamps
    if isinstance(v, pd.Timestamp):
        return v.isoformat()

    # Bytes -> string
    if isinstance(v, (bytes, bytearray)):
        try:
            return v.decode("utf-8")
        except:
            return str(v)

    # Numpy scalar -> Python scalar
    if hasattr(v, "item"):
        try:
            return v.item()
        except:
            pass

    # Lists / dicts remain same
    return v


def is_valid_match_folder(folder_name):
    """
    Only process February folders
    """

    return folder_name.startswith("February_")


# ============================================================
# START
# ============================================================

Path(OUTPUT_ROOT).mkdir(parents=True, exist_ok=True)

master_matches = []

folders = sorted([
    f for f in os.listdir(INPUT_ROOT)
    if os.path.isdir(os.path.join(INPUT_ROOT, f))
    and is_valid_match_folder(f)
])

print("\nFound folders:")
print(folders)
print()

# ============================================================
# PROCESS EACH FOLDER
# ============================================================

for folder_name in folders:

    folder_path = os.path.join(INPUT_ROOT, folder_name)

    output_folder = os.path.join(OUTPUT_ROOT, folder_name)
    Path(output_folder).mkdir(parents=True, exist_ok=True)

    parquet_files = []

    # --------------------------------------------------------
    # Recursive scan
    # --------------------------------------------------------

    for root, dirs, files in os.walk(folder_path):

        for file in files:

            full_path = os.path.join(root, file)

            # Accept:
            # *.parquet
            # *.nakama*
            # files without extension

            if (
                any(file.endswith(ext) for ext in SUPPORTED_EXTENSIONS)
                or ".nakama" in file
            ):
                parquet_files.append(full_path)

    print(f"Processing {folder_name} ({len(parquet_files)} files)")

    # ========================================================
    # PROCESS EACH FILE
    # ========================================================

    for parquet_path in parquet_files:

        try:
            df = pd.read_parquet(parquet_path)

        except Exception as e:
            print(f"\nFailed reading:")
            print(parquet_path)
            print(e)
            continue

        if len(df) == 0:
            continue

        # ----------------------------------------------------
        # Match ID
        # ----------------------------------------------------

        match_id = Path(parquet_path).stem

        print(f"  -> {match_id}")

        # ----------------------------------------------------
        # Detect columns
        # ----------------------------------------------------

        cols = set(df.columns)

        x_col = next(
            (c for c in cols if c.lower() in ["x", "pos_x", "position_x"]),
            None
        )

        y_col = next(
            (c for c in cols if c.lower() in ["y", "pos_y", "position_y"]),
            None
        )

        time_col = next(
            (c for c in cols if "time" in c.lower()),
            None
        )

        player_col = next(
            (c for c in cols if "player" in c.lower()),
            None
        )

        event_col = next(
            (
                c for c in cols
                if "event" in c.lower() or "type" in c.lower()
            ),
            None
        )

        # ----------------------------------------------------
        # Process events
        # ----------------------------------------------------

        processed_events = []

        for _, row in df.iterrows():

            event = {}

            # Store all columns
            for c in df.columns:
                event[c] = safe_value(row[c])

            # Add minimap coords
            if x_col and y_col:

                try:

                    px, py = world_to_pixel(
                        float(row[x_col]),
                        float(row[y_col])
                    )

                    event["map_x"] = px
                    event["map_y"] = py

                except:
                    event["map_x"] = None
                    event["map_y"] = None

            processed_events.append(event)

        # ----------------------------------------------------
        # Match summary
        # ----------------------------------------------------

        match_summary = {
            "match_id": match_id,
            "folder": folder_name,
            "source_file": os.path.basename(parquet_path),
            "json_file": f"{folder_name}/{match_id}.json",
            "events_count": len(processed_events),
            "columns": list(df.columns),
        }

        # Optional metadata
        if time_col:
            try:
                match_summary["start_time"] = safe_value(
                    df[time_col].min()
                )

                match_summary["end_time"] = safe_value(
                    df[time_col].max()
                )

            except:
                pass

        master_matches.append(match_summary)

        # ----------------------------------------------------
        # Save individual match json
        # ----------------------------------------------------

        output_match_path = os.path.join(
            output_folder,
            f"{match_id}.json"
        )

        match_payload = {
            "match_info": match_summary,
            "events": processed_events
        }

        with open(output_match_path, "w", encoding="utf-8") as f:
            json.dump(
                match_payload,
                f,
                ensure_ascii=False
            )

    print()

# ============================================================
# SAVE MASTER INDEX
# ============================================================

master_index_path = os.path.join(
    OUTPUT_ROOT,
    "matches.json"
)

with open(master_index_path, "w", encoding="utf-8") as f:
    json.dump(
        master_matches,
        f,
        indent=2,
        ensure_ascii=False
    )

print("\n================================================")
print("DONE")
print("================================================")
print(f"Master index saved:")
print(master_index_path)
print()
print(f"Total matches processed: {len(master_matches)}")
