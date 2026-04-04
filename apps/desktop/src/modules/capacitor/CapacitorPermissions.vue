<script setup lang="ts">
import { ref, computed } from "vue";
import { Shield, ShieldCheck, ShieldX, ShieldOff, RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockPermissions, type PermissionEntry } from "@/data/mock-data";

const permissions = ref<PermissionEntry[]>(mockPermissions);

const stats = computed(() => ({
  granted: permissions.value.filter((p) => p.status === "granted").length,
  denied: permissions.value.filter((p) => p.status === "denied").length,
  notRequested: permissions.value.filter((p) => p.status === "not_requested").length,
}));

function statusIcon(status: string) {
  if (status === "granted") return ShieldCheck;
  if (status === "denied") return ShieldX;
  return ShieldOff;
}

function statusColor(status: string) {
  if (status === "granted") return "text-success";
  if (status === "denied") return "text-error";
  return "text-muted-foreground";
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Stats bar -->
    <div class="h-8 shrink-0 border-b border-border bg-accent flex items-center px-4 gap-4">
      <div class="flex items-center gap-1.5 text-2xs">
        <span class="text-success">{{ stats.granted }} granted</span>
        <span class="text-error">{{ stats.denied }} denied</span>
        <span class="text-muted-foreground">{{ stats.notRequested }} not requested</span>
      </div>
      <div class="flex-1" />
      <Button variant="ghost" size="sm" class="h-6 text-2xs gap-1.5">
        <RefreshCw class="w-3 h-3" />
        Refresh
      </Button>
    </div>

    <!-- Permissions list -->
    <div class="flex-1 overflow-auto">
      <table class="w-full text-2xs">
        <thead class="sticky top-0 z-10">
          <tr
            class="bg-accent text-left text-muted-foreground uppercase tracking-wider border-b border-border"
          >
            <th class="px-3 py-2 font-medium w-4"></th>
            <th class="px-3 py-2 font-medium">Permission</th>
            <th class="px-3 py-2 font-medium w-64">Android Permission</th>
            <th class="px-3 py-2 font-medium w-20">Status</th>
            <th class="px-3 py-2 font-medium w-36">Last Requested</th>
            <th class="px-3 py-2 font-medium w-20"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="perm in permissions" :key="perm.name" class="border-b border-border data-row">
            <td class="px-3 py-2">
              <component
                :is="statusIcon(perm.status)"
                class="w-3.5 h-3.5"
                :class="statusColor(perm.status)"
              />
            </td>
            <td class="px-3 py-2 text-xs font-medium text-foreground">{{ perm.name }}</td>
            <td class="px-3 py-2 font-mono text-muted-foreground text-[11px]">
              {{ perm.androidPermission }}
            </td>
            <td class="px-3 py-2">
              <Badge
                variant="outline"
                class="text-2xs capitalize border-border"
                :class="statusColor(perm.status)"
              >
                {{ perm.status.replace("_", " ") }}
              </Badge>
            </td>
            <td class="px-3 py-2 font-mono text-muted-foreground text-[11px]">
              {{ perm.lastRequested ? perm.lastRequested.slice(0, 10) : "—" }}
            </td>
            <td class="px-3 py-2">
              <Button
                v-if="perm.status !== 'granted'"
                variant="outline"
                size="sm"
                class="h-6 text-2xs gap-1"
              >
                <Shield class="w-3 h-3" />
                Request
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
