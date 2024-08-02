import { patchFileContent } from '.';

// Remove protestware from SweetAlert2

await patchFileContent('../vendor/sweetalert2/sweetalert2.all.js', (txt) =>
    txt.replace(
        // for minified version:
        // /if\("undefined"!=typeof window&&\/\^ru.+\.concat\(no\)\)}/,
        /\n^ {2}\/\/ Dear russian.+^ {2}}$\n/ms,
        '',
    ),
);
