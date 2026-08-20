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
import styles from "./SplitTunnelingView.module.css";

export const SplitTunnelingView: React.FC = () => {
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
            Split Tunneling Policy Manager
          </Text>
          <Text size="xs" c="dimmed">
            Granularly define which applications, CIDR subnets, and domains route through VPN or
            direct internet
          </Text>
        </Box>
      </Group>

      {/* Main Tabs */}
      <Tabs defaultValue="apps" color="cyan">
        <Tabs.List mb="md">
          <Tabs.Tab value="apps" leftSection={<IconApps size={15} />}>
            Application Rules ({appRules.length})
          </Tabs.Tab>
          <Tabs.Tab value="ip-domain" leftSection={<IconNetwork size={15} />}>
            IP Subnets & Domains ({ipRules.length})
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: Apps */}
        <Tabs.Panel value="apps">
          <Box className={`glass-panel ${styles.panel}`}>
            <Group justify="space-between" align="center" mb="md">
              <Box>
                <Text size="sm" fw={700} className={styles.cardTitle}>
                  Application-Specific Tunnel Rules
                </Text>
                <Text size="xs" c="dimmed">
                  Packets emitted by specified binaries will follow designated routing table
                  overrides
                </Text>
              </Box>

              <Button
                size="xs"
                color="cyan"
                leftSection={<IconPlus size={14} />}
                onClick={() => setAppModalOpen(true)}
              >
                Add Application Rule
              </Button>
            </Group>

            <Table verticalSpacing="xs">
              <Table.Thead className={styles.tableHeader}>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}>Status</Table.Th>
                  <Table.Th>Application</Table.Th>
                  <Table.Th>Executable Path</Table.Th>
                  <Table.Th>Routing Policy</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
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
                        {rule.mode === "route_vpn" ? "Route via VPN" : "Bypass VPN (Direct)"}
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
                Add Subnet CIDR or Domain Rule
              </Text>
              <Group grow align="flex-end">
                <TextInput
                  size="xs"
                  label="Target CIDR / Wildcard Domain"
                  placeholder="10.0.0.0/8 or *.corp.domain.com"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.currentTarget.value)}
                  className="font-mono"
                />
                <Select
                  size="xs"
                  label="Type"
                  data={[
                    { value: "cidr", label: "IPv4/IPv6 CIDR Subnet" },
                    { value: "domain", label: "Domain Pattern" },
                  ]}
                  value={newType}
                  onChange={(val) => setNewType(val as any)}
                  className={styles.selectType}
                />
                <Select
                  size="xs"
                  label="Routing Mode"
                  data={[
                    { value: "route_vpn", label: "Route via VPN" },
                    { value: "bypass", label: "Bypass VPN (Direct)" },
                  ]}
                  value={newMode}
                  onChange={(val) => setNewMode(val as any)}
                  className={styles.selectMode}
                />
                <TextInput
                  size="xs"
                  label="Description / Purpose"
                  placeholder="e.g. AWS VPC Staging"
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
                  Add
                </Button>
              </Group>
            </Box>

            {/* List Table */}
            <Box className={`glass-panel ${styles.panel}`}>
              <Table verticalSpacing="xs">
                <Table.Thead className={styles.tableHeader}>
                  <Table.Tr>
                    <Table.Th style={{ width: 40 }}>Status</Table.Th>
                    <Table.Th>Target Destination</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Policy</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
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
                          {rule.mode === "route_vpn" ? "Route via VPN" : "Bypass VPN"}
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
