export const parseTableString = (val: any, egeNumber?: number, table?: { cols: number; rows: number } | null): (number | string)[][] => {
    let rows: (number | string)[][] = [];
    
    if (Array.isArray(val) && Array.isArray(val[0])) {
        rows = JSON.parse(JSON.stringify(val));
    } else if (typeof val === 'string' && val.trim()) {
        rows = val.trim().split('\n').map(row => 
            row.trim().split(/\s+/).map(cell => cell.trim())
        );
    }

    if (egeNumber !== 27 && table && Number.isInteger(table.cols) && table.cols > 0 && table.cols !== 2
        && Number.isInteger(table.rows) && table.rows > 0) {
        // Reflow old two-column drafts without dropping any entered cells.
        const cells = rows.flat().filter(cell => String(cell).trim() !== "");
        if (rows.some(row => row.length !== table.cols)) {
            rows = Array.from({ length: Math.max(table.rows, Math.ceil(cells.length / table.cols)) },
                (_, i) => cells.slice(i * table.cols, (i + 1) * table.cols));
        }
        while (rows.length > table.rows && rows[rows.length - 1].every(cell => String(cell).trim() === "")) rows.pop();
        return Array.from({ length: Math.max(table.rows, rows.length) }, (_, ri) =>
            Array.from({ length: table.cols }, (_, ci) => rows[ri]?.[ci] ?? ""));
    }

    if (rows.length === 0) {
        if (egeNumber === 27) {
            rows = [["", ""], ["", ""]];
        } else {
            rows = [["", ""]];
        }
    }

    if (rows[0] && rows[0].length === 1) {
        rows = rows.map(r => [r[0], ""]);
    }

    if (egeNumber !== 27) {
        const lastRow = rows[rows.length - 1];
        const isLastRowNotEmpty = lastRow && lastRow.some(cell => String(cell).trim() !== "");
        if (isLastRowNotEmpty) {
            rows.push(new Array(lastRow.length).fill(""));
        }
    } else {
        while (rows.length < 2) rows.push(["", ""]);
    }

    return rows;
};

