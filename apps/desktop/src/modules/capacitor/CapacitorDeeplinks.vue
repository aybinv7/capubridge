<script setup lang="ts">
import { ref } from "vue";
import { Send, ExternalLink, CheckCircle, XCircle, Loader2, Plus, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { mockDeepLinkTests, type DeepLinkTest } from "@/data/mock-data";

const tests = ref<DeepLinkTest[]>(mockDeepLinkTests);
const newUrl = ref("");
const newDescription = ref("");

function addTest() {
  if (!newUrl.value) return;
  tests.value.unshift({
    url: newUrl.value,
    description: newDescription.value || "Custom link",
    status: "pending",
    timestamp: null,
  });
  newUrl.value = "";
  newDescription.value = "";
}

function removeTest(index: number) {
  tests.value.splice(index, 1);
}

function sendTest(test: DeepLinkTest) {
  test.status = "pending";
  setTimeout(() => {
    test.status = Math.random() > 0.3 ? "success" : "failed";
    test.timestamp = new Date().toISOString();
  }, 1500);
}

function statusIcon(status: string) {
  if (status === "success") return CheckCircle;
  if (status === "failed") return XCircle;
  return Loader2;
}

function statusColor(status: string) {
  if (status === "success") return "text-success";
  if (status === "failed") return "text-error";
  return "text-warning";
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Add new link -->
    <div class="h-12 shrink-0 border-b border-border/20 bg-surface-1 flex items-center px-4 gap-2">
      <Input
        v-model="newUrl"
        class="h-7 text-xs font-mono bg-surface-2/50 border-border/20"
        placeholder="myapp://path/to/screen"
        @keydown.enter="addTest"
      />
      <Input
        v-model="newDescription"
        class="h-7 text-xs bg-surface-2/50 border-border/20 w-40"
        placeholder="Description"
        @keydown.enter="addTest"
      />
      <Button size="sm" class="h-7 gap-1.5" @click="addTest">
        <Plus class="w-3 h-3" />
        Add
      </Button>
    </div>

    <!-- Tests list -->
    <div class="flex-1 overflow-auto p-4">
      <div class="max-w-2xl space-y-2">
        <div
          v-for="(test, i) in tests"
          :key="i"
          class="flex items-center gap-3 p-3 rounded-lg border border-border/20 bg-surface-2/30"
        >
          <component
            :is="statusIcon(test.status)"
            class="w-4 h-4 shrink-0"
            :class="[statusColor(test.status), test.status === 'pending' ? 'animate-spin' : '']"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-xs font-mono text-foreground truncate">{{ test.url }}</span>
              <Badge
                v-if="test.status !== 'pending'"
                variant="outline"
                class="text-2xs capitalize border-border/20"
                :class="statusColor(test.status)"
              >
                {{ test.status }}
              </Badge>
            </div>
            <div class="text-2xs text-muted-foreground">{{ test.description }}</div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" class="h-6 text-2xs gap-1" @click="sendTest(test)">
              <Send class="w-3 h-3" />
              Send
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              class="w-6 h-6 text-dimmed"
              @click="removeTest(i)"
            >
              <Trash2 class="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
