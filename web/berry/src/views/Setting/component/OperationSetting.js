import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
              <InputLabel htmlFor="TopUpLink">{t('setting.operation.general.topup_link')}</InputLabel>
              <OutlinedInput
                id="TopUpLink"
                name="TopUpLink"
                value={inputs.TopUpLink}
                onChange={handleInputChange}
                label={t('setting.operation.general.topup_link')}
                placeholder="例如发卡网站的购买链接"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="ChatLink">{t('setting.operation.general.chat_link')}</InputLabel>
              <OutlinedInput
                id="ChatLink"
                name="ChatLink"
                value={inputs.ChatLink}
                onChange={handleInputChange}
                label={t('setting.operation.general.chat_link')}
                placeholder="例如 ChatGPT Next Web 的部署地址"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaPerUnit">{t('setting.operation.general.quota_per_unit')}</InputLabel>
              <OutlinedInput
                id="QuotaPerUnit"
                name="QuotaPerUnit"
                value={inputs.QuotaPerUnit}
                onChange={handleInputChange}
                label={t('setting.operation.general.quota_per_unit')}
                placeholder={t('setting.operation.general.quota_per_unit_placeholder')}
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="RetryTimes">{t('setting.operation.general.retry_times')}</InputLabel>
              <OutlinedInput
                id="RetryTimes"
                name="RetryTimes"
                value={inputs.RetryTimes}
                onChange={handleInputChange}
                label={t('setting.operation.general.retry_times')}
                placeholder={t('setting.operation.general.retry_times_placeholder')}
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
              label={t('setting.operation.general.display_in_currency')}
              control={
                <Checkbox
                  checked={inputs.DisplayInCurrencyEnabled === "true"}
                  onChange={handleInputChange}
                  name="DisplayInCurrencyEnabled"
                />
              }
            />

            <FormControlLabel
              label={t('setting.operation.general.display_token_stat')}
              control={
                <Checkbox
                  checked={inputs.DisplayTokenStatEnabled === "true"}
                  onChange={handleInputChange}
                  name="DisplayTokenStatEnabled"
                />
              }
            />

            <FormControlLabel
              label={t('setting.operation.general.approximate_token')}
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
            {t('setting.operation.general.buttons.save')}
          </Button>
        </Stack>
      </SubCard>
      <SubCard title={t('setting.operation.log.title')}>
        <Stack
          direction="column"
          justifyContent="flex-start"
          alignItems="flex-start"
          spacing={2}
        >
          <FormControlLabel
            label={t('setting.operation.log.enable_consume')}
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
                label={t('setting.operation.log.target_time')}
                placeholder={t('setting.operation.log.target_time')}
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
            {t('setting.operation.log.buttons.clean')}
          </Button>
        </Stack>
      </SubCard>
      <SubCard title={t('setting.operation.monitor.title')}>
        <Stack justifyContent="flex-start" alignItems="flex-start" spacing={2}>
          <Stack
            direction={{ sm: "column", md: "row" }}
            spacing={{ xs: 3, sm: 2, md: 4 }}
          >
            <FormControl fullWidth>
              <InputLabel htmlFor="ChannelDisableThreshold">
                {t('setting.operation.monitor.max_response_time')}
              </InputLabel>
              <OutlinedInput
                id="ChannelDisableThreshold"
                name="ChannelDisableThreshold"
                type="number"
                value={inputs.ChannelDisableThreshold}
                onChange={handleInputChange}
                label={t('setting.operation.monitor.max_response_time')}
                placeholder={t('setting.operation.monitor.max_response_time_placeholder')}
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaRemindThreshold">
                {t('setting.operation.monitor.quota_reminder')}
              </InputLabel>
              <OutlinedInput
                id="QuotaRemindThreshold"
                name="QuotaRemindThreshold"
                type="number"
                value={inputs.QuotaRemindThreshold}
                onChange={handleInputChange}
                label={t('setting.operation.monitor.quota_reminder')}
                placeholder={t('setting.operation.monitor.quota_reminder_placeholder')}
                disabled={loading}
              />
            </FormControl>
          </Stack>
          <FormControlLabel
            label={t('setting.operation.monitor.auto_disable')}
            control={
              <Checkbox
                checked={inputs.AutomaticDisableChannelEnabled === "true"}
                onChange={handleInputChange}
                name="AutomaticDisableChannelEnabled"
              />
            }
          />
          <FormControlLabel
            label={t('setting.operation.monitor.auto_enable')}
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
            {t('setting.operation.monitor.buttons.save')}
          </Button>
        </Stack>
      </SubCard>
      <SubCard title={t('setting.operation.quota.title')}>
        <Stack justifyContent="flex-start" alignItems="flex-start" spacing={2}>
          <Stack
            direction={{ sm: "column", md: "row" }}
            spacing={{ xs: 3, sm: 2, md: 4 }}
          >
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaForNewUser">{t('setting.operation.quota.new_user')}</InputLabel>
              <OutlinedInput
                id="QuotaForNewUser"
                name="QuotaForNewUser"
                type="number"
                value={inputs.QuotaForNewUser}
                onChange={handleInputChange}
                label={t('setting.operation.quota.new_user')}
                placeholder="例如：100"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="PreConsumedQuota">{t('setting.operation.quota.pre_consume')}</InputLabel>
              <OutlinedInput
                id="PreConsumedQuota"
                name="PreConsumedQuota"
                type="number"
                value={inputs.PreConsumedQuota}
                onChange={handleInputChange}
                label={t('setting.operation.quota.pre_consume')}
                placeholder={t('setting.operation.quota.pre_consume_placeholder')}
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaForInviter">
                {t('setting.operation.quota.inviter_reward')}
              </InputLabel>
              <OutlinedInput
                id="QuotaForInviter"
                name="QuotaForInviter"
                type="number"
                label={t('setting.operation.quota.inviter_reward')}
                value={inputs.QuotaForInviter}
                onChange={handleInputChange}
                placeholder="例如：2000"
                disabled={loading}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel htmlFor="QuotaForInvitee">
                {t('setting.operation.quota.invitee_reward')}
              </InputLabel>
              <OutlinedInput
                id="QuotaForInvitee"
                name="QuotaForInvitee"
                type="number"
                label={t('setting.operation.quota.invitee_reward')}
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
            {t('setting.operation.quota.buttons.save')}
          </Button>
        </Stack>
      </SubCard>
      <SubCard title={t('setting.operation.ratio.title')}>
        <Stack justifyContent="flex-start" alignItems="flex-start" spacing={2}>
          <FormControl fullWidth>
            <TextField
              multiline
              maxRows={15}
              id="channel-ModelRatio-label"
              label={t('setting.operation.ratio.model.title')}
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
              label={t('setting.operation.ratio.completion.title')}
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
              label={t('setting.operation.ratio.group.title')}
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
            {t('setting.operation.ratio.buttons.save')}
          </Button>
        </Stack>
      </SubCard>
    </Stack>
  );
};

export default OperationSetting;
