import { useState, useEffect } from "react";
import SubCard from "ui-component/cards/SubCard";
import {
  Stack,
  FormControl,
  InputLabel,
  OutlinedInput,
  Checkbox,
  Button,
  FormControlLabel,
  TextField,
} from "@mui/material";
import { showSuccess, showError, verifyJSON } from "utils/common";
import { API } from "utils/api";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs from "dayjs";
require("dayjs/locale/zh-cn");

const OperationSetting = () => {
  let now = new Date();
  let [inputs, setInputs] = useState({
    QuotaForNewUser: 0,
    QuotaForInviter: 0,
    QuotaForInvitee: 0,
    QuotaRemindThreshold: 0,
    PreConsumedQuota: 0,
    ModelRatio: "",
    CompletionRatio: "",
    GroupRatio: "",
    TopUpLink: "",
    ChatLink: "",
    QuotaPerUnit: 0,
    AutomaticDisableChannelEnabled: "",
    AutomaticEnableChannelEnabled: "",
    ChannelDisableThreshold: 0,
    LogConsumeEnabled: "",
    DisplayInCurrencyEnabled: "",
    DisplayTokenStatEnabled: "",
    ApproximateTokenEnabled: "",
    RetryTimes: 0,
  });
  const [originInputs, setOriginInputs] = useState({});
  let [loading, setLoading] = useState(false);
  let [historyTimestamp, setHistoryTimestamp] = useState(
    now.getTime() / 1000 - 30 * 24 * 3600
  ); // a month ago new Date().getTime() / 1000 + 3600

  const getOptions = async () => {
    const res = await API.get("/api/option/");
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.key === "ModelRatio" || item.key === "GroupRatio" || item.key === "CompletionRatio") {
          item.value = JSON.stringify(JSON.parse(item.value), null, 2);
        }
        if (item.value === '{}') {
          item.value = '';
        }
        newInputs[item.key] = item.value;
      });
      setInputs(newInputs);
      setOriginInputs(newInputs);
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    getOptions().then();
  }, []);

  const updateOption = async (key, value) => {
    setLoading(true);
    if (key.endsWith("Enabled")) {
      value = inputs[key] === "true" ? "false" : "true";
    }
    const res = await API.put("/api/option/", {
      key,
      value,
    });
    const { success, message } = res.data;
    if (success) {
      setInputs((inputs) => ({ ...inputs, [key]: value }));
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const handleInputChange = async (event) => {
    let { name, value } = event.target;

    if (name.endsWith("Enabled")) {
      await updateOption(name, value);
      showSuccess("SettingsSuccess！");
    } else {
      setInputs((inputs) => ({ ...inputs, [name]: value }));
    }
  };

  const submitConfig = async (group) => {
    switch (group) {
      case "monitor":
        if (
          originInputs["ChannelDisableThreshold"] !==
          inputs.ChannelDisableThreshold
        ) {
          await updateOption(
            "ChannelDisableThreshold",
            inputs.ChannelDisableThreshold
          );
        }
        if (
          originInputs["QuotaRemindThreshold"] !== inputs.QuotaRemindThreshold
        ) {
          await updateOption(
            "QuotaRemindThreshold",
            inputs.QuotaRemindThreshold
          );
        }
        break;
      case "ratio":
        if (originInputs["ModelRatio"] !== inputs.ModelRatio) {
          if (!verifyJSON(inputs.ModelRatio)) {
            showError("Model ratio is not a valid JSON string");
            return;
          }
          await updateOption("ModelRatio", inputs.ModelRatio);
        }
        if (originInputs["GroupRatio"] !== inputs.GroupRatio) {
          if (!verifyJSON(inputs.GroupRatio)) {
            showError("Group ratio is not a valid JSON string");
            return;
          }
          await updateOption("GroupRatio", inputs.GroupRatio);
        }
        if (originInputs['CompletionRatio'] !== inputs.CompletionRatio) {
          if (!verifyJSON(inputs.CompletionRatio)) {
            showError('Completion ratio is not a valid JSON string');
            return;
          }
          await updateOption('CompletionRatio', inputs.CompletionRatio);
        }
        break;
      case "quota":
        if (originInputs["QuotaForNewUser"] !== inputs.QuotaForNewUser) {
          await updateOption("QuotaForNewUser", inputs.QuotaForNewUser);
        }
        if (originInputs["QuotaForInvitee"] !== inputs.QuotaForInvitee) {
          await updateOption("QuotaForInvitee", inputs.QuotaForInvitee);
        }
        if (originInputs["QuotaForInviter"] !== inputs.QuotaForInviter) {
          await updateOption("QuotaForInviter", inputs.QuotaForInviter);
        }
        if (originInputs["PreConsumedQuota"] !== inputs.PreConsumedQuota) {
          await updateOption("PreConsumedQuota", inputs.PreConsumedQuota);
        }
        break;
      case "general":
        if (originInputs["TopUpLink"] !== inputs.TopUpLink) {
          await updateOption("TopUpLink", inputs.TopUpLink);
        }
        if (originInputs["ChatLink"] !== inputs.ChatLink) {
          await updateOption("ChatLink", inputs.ChatLink);
        }
        if (originInputs["QuotaPerUnit"] !== inputs.QuotaPerUnit) {
          await updateOption("QuotaPerUnit", inputs.QuotaPerUnit);
        }
        if (originInputs["RetryTimes"] !== inputs.RetryTimes) {
          await updateOption("RetryTimes", inputs.RetryTimes);
        }
        break;
    }

    showSuccess("SaveSuccess！");
  };

  const deleteHistoryLogs = async () => {
    const res = await API.delete(
      `/api/log/?target_timestamp=${Math.floor(historyTimestamp)}`
    );
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(`${data} 条Logs已清理！`);
      return;
    }
    showError("Logs清理Failed：" + message);
  };

  return (
    <Stack spacing={2}>
      <SubCard title="General settings">
        <Stack justifyContent="flex-start" alignItems="flex-start" spacing={2}>
          <Stack
            direction={{ sm: "column", md: "row" }}
            spacing={{ xs: 3, sm: 2, md: 4 }}
          >
            <FormControl fullWidth>
              <InputLabel htmlFor="TopUpLink">Topup链接</InputLabel>
              <OutlinedInput
                id="TopUpLink"
                name="TopUpLink"
                value={inputs.TopUpLink}
                onChange={handleInputChange}
                label="Topup链接"
                placeholder="例如发卡网站的购买链接"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="ChatLink">Chat链接</InputLabel>
              <OutlinedInput
                id="ChatLink"
                name="ChatLink"
                value={inputs.ChatLink}
                onChange={handleInputChange}
                label="Chat链接"
                placeholder="例如 ChatGPT Next Web 的部署地址"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaPerUnit">单位Quota</InputLabel>
              <OutlinedInput
                id="QuotaPerUnit"
                name="QuotaPerUnit"
                value={inputs.QuotaPerUnit}
                onChange={handleInputChange}
                label="单位Quota"
                placeholder="一单位货币能Redeem的Quota"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="RetryTimes">重试次数</InputLabel>
              <OutlinedInput
                id="RetryTimes"
                name="RetryTimes"
                value={inputs.RetryTimes}
                onChange={handleInputChange}
                label="重试次数"
                placeholder="重试次数"
                disabled={loading}
              />
            </FormControl>
          </Stack>
          <Stack
            direction={{ sm: "column", md: "row" }}
            spacing={{ xs: 3, sm: 2, md: 4 }}
            justifyContent="flex-start"
            alignItems="flex-start"
          >
            <FormControlLabel
              sx={{ marginLeft: "0px" }}
              label="以货币形式显示Quota"
              control={
                <Checkbox
                  checked={inputs.DisplayInCurrencyEnabled === "true"}
                  onChange={handleInputChange}
                  name="DisplayInCurrencyEnabled"
                />
              }
            />

            <FormControlLabel
              label="Billing 相关 API 显示TokenQuota而非UserQuota"
              control={
                <Checkbox
                  checked={inputs.DisplayTokenStatEnabled === "true"}
                  onChange={handleInputChange}
                  name="DisplayTokenStatEnabled"
                />
              }
            />

            <FormControlLabel
              label="使用近似的方式估算 token 数以减少计算量"
              control={
                <Checkbox
                  checked={inputs.ApproximateTokenEnabled === "true"}
                  onChange={handleInputChange}
                  name="ApproximateTokenEnabled"
                />
              }
            />
          </Stack>
          <Button
            variant="contained"
            onClick={() => {
              submitConfig("general").then();
            }}
          >
            SaveGeneral settings
          </Button>
        </Stack>
      </SubCard>
      <SubCard title="LogsSettings">
        <Stack
          direction="column"
          justifyContent="flex-start"
          alignItems="flex-start"
          spacing={2}
        >
          <FormControlLabel
            label="EnableLogsUsage"
            control={
              <Checkbox
                checked={inputs.LogConsumeEnabled === "true"}
                onChange={handleInputChange}
                name="LogConsumeEnabled"
              />
            }
          />

          <FormControl>
            <LocalizationProvider
              dateAdapter={AdapterDayjs}
              adapterLocale={"zh-cn"}
            >
              <DateTimePicker
                label="Logs清理Time"
                placeholder="Logs清理Time"
                ampm={false}
                name="historyTimestamp"
                value={
                  historyTimestamp === null
                    ? null
                    : dayjs.unix(historyTimestamp)
                }
                disabled={loading}
                onChange={(newValue) => {
                  setHistoryTimestamp(
                    newValue === null ? null : newValue.unix()
                  );
                }}
                slotProps={{
                  actionBar: {
                    actions: ["today", "clear", "accept"],
                  },
                }}
              />
            </LocalizationProvider>
          </FormControl>
          <Button
            variant="contained"
            onClick={() => {
              deleteHistoryLogs().then();
            }}
          >
            清理历史Logs
          </Button>
        </Stack>
      </SubCard>
      <SubCard title="监控Settings">
        <Stack justifyContent="flex-start" alignItems="flex-start" spacing={2}>
          <Stack
            direction={{ sm: "column", md: "row" }}
            spacing={{ xs: 3, sm: 2, md: 4 }}
          >
            <FormControl fullWidth>
              <InputLabel htmlFor="ChannelDisableThreshold">
                最长ResponseTime
              </InputLabel>
              <OutlinedInput
                id="ChannelDisableThreshold"
                name="ChannelDisableThreshold"
                type="number"
                value={inputs.ChannelDisableThreshold}
                onChange={handleInputChange}
                label="最长ResponseTime"
                placeholder="单位秒，当运行ChannelAllTest时，超过此Time将Auto DisabledChannel"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaRemindThreshold">
                Quota提醒阈值
              </InputLabel>
              <OutlinedInput
                id="QuotaRemindThreshold"
                name="QuotaRemindThreshold"
                type="number"
                value={inputs.QuotaRemindThreshold}
                onChange={handleInputChange}
                label="Quota提醒阈值"
                placeholder="低于此Quota时将发送邮件提醒User"
                disabled={loading}
              />
            </FormControl>
          </Stack>
          <FormControlLabel
            label="Failed时Auto DisabledChannel"
            control={
              <Checkbox
                checked={inputs.AutomaticDisableChannelEnabled === "true"}
                onChange={handleInputChange}
                name="AutomaticDisableChannelEnabled"
              />
            }
          />
          <FormControlLabel
            label="Success时自动EnableChannel"
            control={
              <Checkbox
                checked={inputs.AutomaticEnableChannelEnabled === "true"}
                onChange={handleInputChange}
                name="AutomaticEnableChannelEnabled"
              />
            }
          />
          <Button
            variant="contained"
            onClick={() => {
              submitConfig("monitor").then();
            }}
          >
            Save监控Settings
          </Button>
        </Stack>
      </SubCard>
      <SubCard title="QuotaSettings">
        <Stack justifyContent="flex-start" alignItems="flex-start" spacing={2}>
          <Stack
            direction={{ sm: "column", md: "row" }}
            spacing={{ xs: 3, sm: 2, md: 4 }}
          >
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaForNewUser">新User初始Quota</InputLabel>
              <OutlinedInput
                id="QuotaForNewUser"
                name="QuotaForNewUser"
                type="number"
                value={inputs.QuotaForNewUser}
                onChange={handleInputChange}
                label="新User初始Quota"
                placeholder="例如：100"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="PreConsumedQuota">Request预扣费Quota</InputLabel>
              <OutlinedInput
                id="PreConsumedQuota"
                name="PreConsumedQuota"
                type="number"
                value={inputs.PreConsumedQuota}
                onChange={handleInputChange}
                label="Request预扣费Quota"
                placeholder="Request结束后多退少补"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaForInviter">
                Invite新User奖励Quota
              </InputLabel>
              <OutlinedInput
                id="QuotaForInviter"
                name="QuotaForInviter"
                type="number"
                label="Invite新User奖励Quota"
                value={inputs.QuotaForInviter}
                onChange={handleInputChange}
                placeholder="例如：2000"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaForInvitee">
                新User使用Invite码奖励Quota
              </InputLabel>
              <OutlinedInput
                id="QuotaForInvitee"
                name="QuotaForInvitee"
                type="number"
                label="新User使用Invite码奖励Quota"
                value={inputs.QuotaForInvitee}
                onChange={handleInputChange}
                autoComplete="new-password"
                placeholder="例如：1000"
                disabled={loading}
              />
            </FormControl>
          </Stack>
          <Button
            variant="contained"
            onClick={() => {
              submitConfig("quota").then();
            }}
          >
            SaveQuotaSettings
          </Button>
        </Stack>
      </SubCard>
      <SubCard title="倍率Settings">
        <Stack justifyContent="flex-start" alignItems="flex-start" spacing={2}>
          <FormControl fullWidth>
            <TextField
              multiline
              maxRows={15}
              id="channel-ModelRatio-label"
              label="Model倍率"
              value={inputs.ModelRatio}
              name="ModelRatio"
              onChange={handleInputChange}
              aria-describedby="helper-text-channel-ModelRatio-label"
              minRows={5}
              placeholder="为一个 JSON 文本，键为ModelName，值为倍率"
            />
          </FormControl>
          <FormControl fullWidth>
            <TextField
              multiline
              maxRows={15}
              id="channel-CompletionRatio-label"
              label="补全倍率"
              value={inputs.CompletionRatio}
              name="CompletionRatio"
              onChange={handleInputChange}
              aria-describedby="helper-text-channel-CompletionRatio-label"
              minRows={5}
              placeholder="为一个 JSON 文本，键为ModelName，值为倍率，此处的倍率Settings是Model补全倍率相较于提示倍率的比例，使用该Settings可强制覆盖 One API 的内部比例"
            />
          </FormControl>
          <FormControl fullWidth>
            <TextField
              multiline
              maxRows={15}
              id="channel-GroupRatio-label"
              label="Group倍率"
              value={inputs.GroupRatio}
              name="GroupRatio"
              onChange={handleInputChange}
              aria-describedby="helper-text-channel-GroupRatio-label"
              minRows={5}
              placeholder="为一个 JSON 文本，键为GroupName，值为倍率"
            />
          </FormControl>
          <Button
            variant="contained"
            onClick={() => {
              submitConfig("ratio").then();
            }}
          >
            Save倍率Settings
          </Button>
        </Stack>
      </SubCard>
    </Stack>
  );
};

export default OperationSetting;
