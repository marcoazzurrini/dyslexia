import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Schema } from "effect";

import { useNarrations } from "../components/narrations-provider";
import { useListening } from "../lib/listening";
import { useBottomInset } from "../player/inset";
import { LibraryScreen } from "../screens/library-screen";

// The filter lives in the address, so Back and a reload keep it.
const LibrarySearch = Schema.Struct({
  show: Schema.optional(
    Schema.Literals(["not-started", "in-progress", "finished"])
  ),
});

const Library = () => {
  const library = useNarrations();
  const listeningOf = useListening();
  const { show } = useSearch({ from: "/library" });
  const navigate = useNavigate({ from: "/library" });
  return (
    <LibraryScreen
      narrations={library.narrations}
      error={library.loadError}
      deleteError={library.deleteError}
      filter={show ?? "all"}
      onFilter={(filter) => {
        void navigate({
          replace: true,
          search: filter === "all" ? {} : { show: filter },
        });
      }}
      listeningOf={listeningOf}
      bottomInset={useBottomInset()}
      onReload={library.handleReload}
      onAdd={library.handleAdd}
      onOpen={library.handleOpen}
      onListen={library.handleListen}
      onPause={library.handlePause}
      playingId={library.playingId}
      onOpenFailed={library.handleOpenFailed}
      onOptions={library.handleOpenOptions}
      onDelete={library.handleRemove}
    />
  );
};

export const Route = createFileRoute("/library")({
  component: Library,
  validateSearch: Schema.toStandardSchemaV1(LibrarySearch),
});
