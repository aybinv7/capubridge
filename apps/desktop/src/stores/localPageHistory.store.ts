import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";
import {
  describeVisit,
  iconForUrl,
  isVisitList,
  recordVisit,
  type LocalPageVisit,
} from "@/lib/local-page-history";

const LS_LOCAL_PAGES = "capubridge:local-page-history";

/** The pages opened on This PC, newest first, with the title and icon each one reported. */
export const useLocalPageHistoryStore = defineStore("localPageHistory", () => {
  const visits = ref<LocalPageVisit[]>(readPersisted(LS_LOCAL_PAGES, [], isVisitList));

  watch(visits, (next) => writePersisted(LS_LOCAL_PAGES, next));

  function record(url: string) {
    visits.value = recordVisit(visits.value, url, Date.now());
  }

  function describe(url: string, details: { title: string; icon: string | null }) {
    visits.value = describeVisit(visits.value, url, details);
  }

  function forget(url: string) {
    visits.value = visits.value.filter((visit) => visit.url !== url);
  }

  function iconOf(url: string) {
    return iconForUrl(visits.value, url);
  }

  return { visits, record, describe, forget, iconOf };
});
