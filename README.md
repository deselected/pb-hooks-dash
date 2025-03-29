# pb-hooks-dash

A drop-in web dashboard to view and edit [PocketBase](https://pocketbase.io/docs/use-as-framework/) custom hooks/functions through the browser. 

**Contents**

 - [Getting Started](#getting-started)
 - [Usage Notes](#usage-notes)
   - [Customisation](#customisation)
 - [Technical Details](#technical-details)
 - [Future Work](#possible-future-work)
 - [Contact](#contact)

# Getting Started

1. Copy the `pb_hooks/_hooks-dash.pb.js` file and the `pb_public/hooks-dash/` folder into the respective folders on your PB server, or wherever you've specified with `--publicDir`/`--hooksDir`.

3. If you aren't already, login to the normal `/_` admin dashboard of your server (eg `http://localhost:8090/_`). The hooks dashboard piggybacks this auth token.

4. Access the hooks dashboard at the `/hooks-dash` path of your server (eg `http://localhost:8090/hooks-dash`).

# Usage Notes

Creating a new file has a `.pb.js` extension pre-filled only for convenience, but any file extension works fine. If you mainly work with GO, or prefer empty default, you can change `DEFAULT_FILE_EXTENSION` at the top of `hooks-dash/index.js` if you want.

The sidebar can theoretically load/display any level of folder nesting that already exists, but creating a new file/folder via UI is currently only supported at the `pb_hooks/` root folder level. There's a shonky workaround where you can specify the path in the filename input field to create something in an existing folder. 

Moving files between folders and deleting/renaming folders is currently not supported through the UI.

**Read Only Mode** prevents editing/deleting anything, and piggybacks the existing server setting for *'Hide collection create and edit controls'* set in `/_/#/settings`.

For transparency to avoid route collisions, this adds the following API routes on the PB server:
 - `/hooks-dash/folder` (GET / PUT)
 - `/hooks-dash/file` (GET / PUT / DELETE)

## Customisation

### Languages

Syntax highlighting for JS, GO, and SQL is included out of the box. You can add [more languages](https://highlightjs.readthedocs.io/en/latest/supported-languages.html) if you want by adding the script tag next to the others near the bottom of `hooks-dash/index.html`, either dropped into `lib/` or reference straight from CDN eg:
```html
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/languages/javascript.min.js"></script>
```

### Colour Theme

Default code editor colour theme is *atom-one-light*. You can change the [colour theme](https://highlightjs.org/demo) by swapping out the `lib/highlight.theme.min.css` file, or change the link tag near the bottom of `hooks-dash/index.html` to reference a different one from CDN eg:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-light.min.css">
```

# Technical Details

Built against PocketBase v0.25.9, but theoretically will probably work for anything v0.23 and up.

Piggybacks the css of the existing PB admin dashboard, otherwise uses the following libraries just for the code editor panel, which are already included in `pb_public/hooks-dash/lib/`:
 - [code-input](https://github.com/WebCoder49/code-input) v2.4.0
 - [highlight.js](https://highlightjs.org/) v.11.9.0

# Possible Future Work

 - Proper UI workflow for managing multi-level nested folder structure, eg create new files/folders inside folders, move files/folders, rename/delete folders, etc. 
 - Easy-mode hooks UI with helper controls/dropdowns to select request method, middlewares, events, etc. Have already implemented a parser to recognise the separate bits of any hooks inside a `.pb.js` file and can easily re-compose to be a valid `.pb.js` file, just haven't yet thought about/decided how to handle the UI workflow of editing individual hooks, especially with multiple hooks in a single file. 
 - Integrated HTTP route tester.
 - Tab width selector.
 - Drag resize the sidebar, eg for long filenames.
 - Piggyback the existing Prism code editor library from the PB admin dashboard. Then don't need a `hooks-dash` folder to contain `lib/` and everything, it can just be a single drop-in `hooks-dash.html` file.

# Contact

Raise an issue/discussion in this repo.
