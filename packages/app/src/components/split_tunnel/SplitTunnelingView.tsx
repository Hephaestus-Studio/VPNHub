import { useState } from "react";
import {
  Box,
  Stack,
  Group,
  Text,
  Button,
  Tabs,
  Badge,
  Switch,
  ActionIcon,
  Table,
  TextInput,
  Select,
} from "@mantine/core";
import { IconApps, IconNetwork, IconPlus, IconTrash } from "@tabler/icons-react";
import { useVpnStore } from "../../state/useVpnStore";
import { AddAppRuleModal } from "./AddAppRuleModal";
import { IpDomainRule } from "../../types/vpn";
import { useTranslation } from "../../i18n";
import styles from "./SplitTunnelingView.module.css";

export const SplitTunnelingView: React.FC = () => {
  const { t } = useTranslation();
  const { appRules, toggleAppRule, deleteAppRule, ipRules, toggleIpRule, deleteIpRule, addIpRule } =
    useVpnStore();

  const [isAppModalOpen, setAppModalOpen] = useState(false);

  // New IP Rule State
  const [newTarget, setNewTarget] = useState("");
  const [newType, setNewType] = useState<"cidr" | "domain">("cidr");
  const [newDesc, setNewDesc] = useState("");
  const [newMode, setNewMode] = useState<"bypass" | "route_vpn">("route_vpn");

  const handleAddIpRule = () => {
    if (!newTarget) return;

    const rule: IpDomainRule = {
      id: crypto.randomUUID(),
      target: newTarget,
      type: newType,
      description: newDesc || (newType === "cidr" ? "Custom Subnet" : "Custom Domain Pattern"),
      mode: newMode,
      enabled: true,
    };

    addIpRule(rule);
    setNewTarget("");
    setNewDesc("");
  };

  return (
    <Box className={styles.root}>
      {/* Header */}
      <Group justify="space-between" align="center">
        <Box>
          <Text size="xl" fw={700} className={styles.title}>
            {t.splitTunnel.title}
          </Text>
          <Text size="xs" c="dimmed">
            {t.splitTunnel.subtitle}
          </Text>
        </Box>
      </Group>

      {/* Main Tabs */}
      <Tabs defaultValue="apps" color="cyan">
        <Tabs.List mb="md">
          <Tabs.Tab value="apps" leftSection={<IconApps size={15} />}>
            {t.splitTunnel.tabApps} ({appRules.length})
          </Tabs.Tab>
          <Tabs.Tab value="ip-domain" leftSection={<IconNetwork size={15} />}>
            {t.splitTunnel.tabIpDomain} ({ipRules.length})
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: Apps */}
        <Tabs.Panel value="apps">
          <Box className={`glass-panel ${styles.panel}`}>
            <Group justify="space-between" align="center" mb="md">
              <Box>
                <Text size="sm" fw={700} className={styles.cardTitle}>
                  {t.splitTunnel.appsSectionTitle}
                </Text>
                <Text size="xs" c="dimmed">
                  {t.splitTunnel.appsSectionDesc}
                </Text>
              </Box>

              <Button
                size="xs"
                color="cyan"
                leftSection={<IconPlus size={14} />}
                onClick={() => setAppModalOpen(true)}
              >
                {t.splitTunnel.btnAddAppRule}
              </Button>
            </Group>

            <Table verticalSpacing="xs">
              <Table.Thead className={styles.tableHeader}>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}>{t.splitTunnel.colStatus}</Table.Th>
                  <Table.Th>{t.splitTunnel.colApp}</Table.Th>
                  <Table.Th>{t.splitTunnel.colPath}</Table.Th>
                  <Table.Th>{t.splitTunnel.colPolicy}</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>{t.splitTunnel.colActions}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {appRules.map((rule) => (
                  <Table.Tr key={rule.id}>
                    <Table.Td>
                      <Switch
                        size="xs"
                        checked={rule.enabled}
                        onChange={() => toggleAppRule(rule.id)}
                        color="cyan"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="md">{rule.icon || "📦"}</Text>
                        <Text size="sm" fw={600} className={styles.appName}>
                          {rule.name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" className="font-mono" c="dimmed">
                        {rule.path}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={rule.mode === "route_vpn" ? "teal" : "yellow"}
                        variant="light"
                      >
                        {rule.mode === "route_vpn"
                          ? t.splitTunnel.routeVpnBadge
                          : t.splitTunnel.bypassBadge}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => deleteAppRule(rule.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        </Tabs.Panel>

        {/* Tab 2: IP / Domain Rules */}
        <Tabs.Panel value="ip-domain">
          <Stack gap="md">
            {/* Quick Add Form */}
            <Box className={`glass-panel ${styles.panel}`}>
              <Text size="xs" fw={700} className={styles.cardTitle} mb="xs">
                {t.splitTunnel.addIpSectionTitle}
              </Text>
              <Group grow align="flex-end">
                <TextInput
                  size="xs"
                  label={t.splitTunnel.targetLabel}
                  placeholder={t.splitTunnel.targetPlaceholder}
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.currentTarget.value)}
                  className="font-mono"
                />
                <Select
                  size="xs"
                  label={t.splitTunnel.typeLabel}
                  data={[
                    { value: "cidr", label: t.splitTunnel.typeCidr },
                    { value: "domain", label: t.splitTunnel.typeDomain },
                  ]}
                  value={newType}
                  onChange={(val) => setNewType(val as any)}
                  className={styles.selectType}
                />
                <Select
                  size="xs"
                  label={t.splitTunnel.policyLabel}
                  data={[
                    { value: "route_vpn", label: t.splitTunnel.policyRouteVpn },
                    { value: "bypass", label: t.splitTunnel.policyBypass },
                  ]}
                  value={newMode}
                  onChange={(val) => setNewMode(val as any)}
                  className={styles.selectMode}
                />
                <TextInput
                  size="xs"
                  label={t.splitTunnel.descLabel}
                  placeholder={t.splitTunnel.descPlaceholder}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.currentTarget.value)}
                />
                <Button
                  size="xs"
                  color="cyan"
                  onClick={handleAddIpRule}
                  disabled={!newTarget}
                  className={styles.addButton}
                >
                  {t.splitTunnel.btnAddRule}
                </Button>
              </Group>
            </Box>

            {/* List Table */}
            <Box className={`glass-panel ${styles.panel}`}>
              <Table verticalSpacing="xs">
                <Table.Thead className={styles.tableHeader}>
                  <Table.Tr>
                    <Table.Th style={{ width: 40 }}>{t.splitTunnel.colStatus}</Table.Th>
                    <Table.Th>{t.splitTunnel.colTarget}</Table.Th>
                    <Table.Th>{t.splitTunnel.colType}</Table.Th>
                    <Table.Th>{t.splitTunnel.colDesc}</Table.Th>
                    <Table.Th>{t.splitTunnel.colPolicy}</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>{t.splitTunnel.colActions}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ipRules.map((rule) => (
                    <Table.Tr key={rule.id}>
                      <Table.Td>
                        <Switch
                          size="xs"
                          checked={rule.enabled}
                          onChange={() => toggleIpRule(rule.id)}
                          color="cyan"
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={700} className={`font-mono ${styles.targetText}`}>
                          {rule.target}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="outline" color="gray">
                          {rule.type.toUpperCase()}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {rule.description}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          color={rule.mode === "route_vpn" ? "teal" : "yellow"}
                          variant="light"
                        >
                          {rule.mode === "route_vpn"
                            ? t.splitTunnel.policyRouteVpn
                            : t.splitTunnel.policyBypass}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => deleteIpRule(rule.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Add App Modal */}
      <AddAppRuleModal opened={isAppModalOpen} onClose={() => setAppModalOpen(false)} />
    </Box>
  );
};
