import { Button, Dialog, Input, Message } from "@alifd/next";
import { useEffect, useState } from "react";
import { get, patch, post, remove } from "../../services/api";

export default function CollectionsPage() {
  const [collections, setCollections] = useState([]);
  const [nameDialog, setNameDialog] = useState(null);
  const [name, setName] = useState("");
  const load = () =>
    get("/collections")
      .then(setCollections)
      .catch((e) => Message.error(e.message));
  useEffect(() => {
    load();
  }, []);
  const saveName = async () => {
    try {
      nameDialog === "new"
        ? await post("/collections", { name })
        : await patch(`/collections/${nameDialog.id}`, { name });
      setNameDialog(null);
      setName("");
      load();
    } catch (e) {
      Message.error(e.message);
    }
  };
  const deleteCollection = (item) =>
    Dialog.confirm({
      title: "删除收藏夹？",
      content: "收藏夹中的收藏关系将被永久删除。",
      onOk: async () => {
        await remove(`/collections/${item.id}`);
        load();
      },
    });
  return (
    <section className="content-width collections-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">MY WORDS</p>
          <h1>我的收藏夹</h1>
          <p>整理需要反复复习的词汇。</p>
        </div>
        <Button
          type="primary"
          onClick={() => {
            setNameDialog("new");
            setName("");
          }}
        >
          新建收藏夹
        </Button>
      </div>
      <div className="collection-grid">
        {collections.map((item) => (
          <article className="collection-card" key={item.id}>
            <header>
              <div>
                <span>{item.isDefault ? "★ 默认" : "收藏夹"}</span>
                <h2>{item.name}</h2>
              </div>
              <strong>{item._count.favorites}</strong>
            </header>
            <div className="favorite-list">
              {item.favorites.length ? (
                item.favorites.map((fav) => (
                  <div key={fav.id}>
                    <span>
                      <b>{fav.word}</b>
                      {fav.localizedDefinition && (
                        <small>{fav.localizedDefinition}</small>
                      )}
                    </span>
                    <Button
                      text
                      warning
                      onClick={async () => {
                        await remove(
                          `/collections/${item.id}/favorites/${encodeURIComponent(fav.wordKey)}`,
                        );
                        load();
                      }}
                    >
                      移除
                    </Button>
                  </div>
                ))
              ) : (
                <p>还没有收藏词汇</p>
              )}
            </div>
            <footer>
              <Button
                text
                onClick={() => {
                  setNameDialog(item);
                  setName(item.name);
                }}
              >
                重命名
              </Button>
              {!item.isDefault && (
                <Button text warning onClick={() => deleteCollection(item)}>
                  删除
                </Button>
              )}
            </footer>
          </article>
        ))}
      </div>
      <Dialog
        visible={Boolean(nameDialog)}
        title={nameDialog === "new" ? "新建收藏夹" : "重命名收藏夹"}
        onOk={saveName}
        onCancel={() => setNameDialog(null)}
        onClose={() => setNameDialog(null)}
      >
        <Input value={name} onChange={setName} placeholder="收藏夹名称" />
      </Dialog>
    </section>
  );
}
