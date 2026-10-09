import { Button, Message } from "@alifd/next";
import { useEffect, useMemo, useState } from "react";
import { get } from "../../services/api";

function displayValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export default function DatabasePage() {
  const [overview, setOverview] = useState(null);
  const [selectedTable, setSelectedTable] = useState("");
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    get("/admin/database")
      .then((data) => {
        setOverview(data);
        setSelectedTable((current) => current || data.tables[0]?.key || "");
      })
      .catch((error) => Message.error(error.message));
  }, []);

  useEffect(() => {
    if (!selectedTable) {
      return;
    }
    get(`/admin/database/${selectedTable}?page=${page}&pageSize=25`)
      .then(setResult)
      .catch((error) => Message.error(error.message));
  }, [selectedTable, page]);

  const columns = useMemo(
    // 表头直接来自接口字段，页面可适配不同业务表而不写死列名。
    () => (result?.rows?.[0] ? Object.keys(result.rows[0]) : []),
    [result],
  );

  const selectTable = (tableKey) => {
    setSelectedTable(tableKey);
    setPage(1);
  };

  return (
    <section className="content-width admin-page database-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">DATABASE</p>
          <h1>数据库浏览</h1>
          <p>
            共 {overview?.tableCount ?? 0}{" "}
            张业务表。敏感认证字段已隐藏，每页显示 25 条。
          </p>
        </div>
      </div>

      <div className="database-layout">
        <aside className="database-tables" aria-label="数据表列表">
          {overview?.tables.map((table) => (
            <button
              type="button"
              key={table.key}
              className={selectedTable === table.key ? "active" : ""}
              onClick={() => selectTable(table.key)}
            >
              <span>
                <strong>{table.label}</strong>
                <code>{table.name}</code>
              </span>
              <b>{table.count.toLocaleString()}</b>
            </button>
          ))}
        </aside>

        <div className="database-content">
          <header>
            <div>
              <h2>{result?.table.label || "请选择数据表"}</h2>
              {result && <code>{result.table.name}</code>}
              <p>{result ? `${result.total.toLocaleString()} 条记录` : ""}</p>
            </div>
            {result && (
              <span>
                第 {result.page} / {result.totalPages} 页
              </span>
            )}
          </header>

          <div className="database-table-wrap">
            <table className="database-records">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result?.rows.map((row, rowIndex) => (
                  <tr key={row.id ?? row.recordId ?? rowIndex}>
                    {columns.map((column) => (
                      <td key={column} title={displayValue(row[column])}>
                        {displayValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result?.rows.length === 0 && (
              <div className="database-empty">这张表暂无数据</div>
            )}
          </div>

          {result && (
            <footer className="database-pagination">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                上一页
              </Button>
              <span>
                {(page - 1) * result.pageSize + (result.rows.length ? 1 : 0)}–
                {(page - 1) * result.pageSize + result.rows.length} /{" "}
                {result.total}
              </span>
              <Button
                disabled={page >= result.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                下一页
              </Button>
            </footer>
          )}
        </div>
      </div>
    </section>
  );
}
