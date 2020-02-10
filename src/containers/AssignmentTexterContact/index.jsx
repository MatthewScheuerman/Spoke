import PropTypes from "prop-types";
import React from "react";
import { StyleSheet, css } from "aphrodite";
import ContactToolbar from "../../components/ContactToolbar";
import MessageList from "../../components/MessageList";
import ReplyTools from "../../components/ReplyTools";
import AssignmentTexterSurveys from "../../components/AssignmentTexterSurveys";
import RaisedButton from "material-ui/RaisedButton";
import NavigateHomeIcon from "material-ui/svg-icons/action/home";
import { grey100 } from "material-ui/styles/colors";
import IconButton from "material-ui/IconButton/IconButton";
import { Toolbar, ToolbarGroup } from "material-ui/Toolbar";
import { applyScript } from "../../lib/scripts";
import gql from "graphql-tag";
import loadData from "../hoc/load-data";
import yup from "yup";
import GSForm from "../../components/forms/GSForm";
import Form from "react-formal";
import SendButton from "../../components/SendButton";
import BulkSendButton from "../../components/BulkSendButton";
import SendButtonArrow from "../../components/SendButtonArrow";
import CircularProgress from "material-ui/CircularProgress";
import Snackbar from "material-ui/Snackbar";
import {
  getChildren,
  getTopMostParent,
  interactionStepForId,
  isBetweenTextingHours
} from "../../lib";
import { withRouter } from "react-router";
import wrapMutations from "../hoc/wrap-mutations";
import Empty from "../../components/Empty";
import CreateIcon from "material-ui/svg-icons/content/create";
import { dataTest } from "../../lib/attributes";
import { getContactTimezone } from "../../lib/timezones";
import {
  OptOutDialog,
  SkipDialog
} from "../../components/AssignmentTexterContact";
import { NO_TAG } from "../../lib/tags";
import theme from "../../styles/theme";
import Dialog from "material-ui/Dialog";
import FlatButton from "material-ui/FlatButton";

const styles = StyleSheet.create({
  mobile: {
    "@media(minWidth: 425px)": {
      display: "none !important"
    }
  },
  desktop: {
    "@media(maxWidth: 450px)": {
      display: "none !important"
    }
  },
  container: {
    margin: 0,
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    height: "100%"
  },
  overlay: {
    margin: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.2,
    backgroundColor: "black",
    color: "white",
    zIndex: 1000000
  },
  messageForm: {
    backgroundColor: "red"
  },
  loadingIndicator: {
    maxWidth: "50%"
  },
  navigationToolbarTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    position: "relative",
    top: 5
  },
  topFixedSection: {
    flex: "0 0 auto"
  },
  mainSectionContainer: {
    height: "100%",
    display: "flex",
    flexDirection: "row"
  },
  messageSection: {
    flex: "0 0 66%",
    height: "100%",
    display: "flex",
    flexDirection: "column"
  },

  responsesSection: {
    backgroundColor: theme.colors.EWlibertyGreen,
    height: "100%",
    flex: "0 0 34%"
  },

  navButtonsWrapper: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },

  middleScrollingSection: {
    flex: "1 1 auto",
    overflowY: "scroll",
    overflow: "-moz-scrollbars-vertical"
  },
  bottomFixedSection: {
    borderTop: `1px solid ${grey100}`,
    flex: "0 0 auto",
    marginBottom: "none"
  },
  messageField: {
    padding: "0px 8px",
    "@media(maxWidth: 450px)": {
      marginBottom: "8%"
    }
  },
  textField: {
    "@media(maxWidth: 350px)": {
      overflowY: "scroll !important"
    }
  },
  lgMobileToolBar: {
    "@media(maxWidth: 449px) and (minWidth: 300px)": {
      display: "inline-block"
    },
    "@media(maxWidth: 320px) and (minWidth: 300px)": {
      marginLeft: "-30px !important"
    }
  }
});

const inlineStyles = {
  mobileToolBar: {
    position: "absolute",
    bottom: "-5px"
  },
  buttonWidth: {
    minWidth: "110px"
  },

  mobileCannedReplies: {
    "@media(maxWidth: 450px)": {
      marginBottom: "1"
    }
  },
  exitTexterIconButton: {
    float: "right",
    height: "50px",
    zIndex: 100
  },
  toolbarIconButton: {
    position: "absolute",
    top: 0
    // without this the toolbar icons are not centered vertically
  },
  actionToolbar: {
    backgroundColor: "white",

    "@media(minWidth: 450px)": {
      marginBottom: 5
    },
    "@media(maxWidth: 450px)": {
      marginBottom: 50
    }
  },

  actionToolbarFirst: {
    backgroundColor: "white"
  },

  snackbar: {
    zIndex: 1000001
  }
};

export class AssignmentTexterContact extends React.Component {
  constructor(props) {
    super(props);

    const { assignment, campaign } = this.props;
    const { contact } = this.props;
    const questionResponses = this.getInitialQuestionResponses(
      contact.questionResponseValues
    );
    const availableSteps = this.getAvailableInteractionSteps(questionResponses);

    let disabled = false;
    let notSendableButForceDisplay = false;
    let disabledText = "Sending...";
    let snackbarOnTouchTap = null;
    let snackbarActionTitle = null;
    let snackbarError = null;

    if (assignment.id !== contact.assignmentId || campaign.isArchived) {
      disabledText = "";
      disabled = true;
      snackbarError = "Your assignment has changed";
      snackbarOnTouchTap = this.goBackToTodos;
      snackbarActionTitle = "Back to Todos";
    } else if (contact.optOut) {
      if (!this.props.forceDisabledDisplayIfNotSendable) {
        disabledText = "Skipping opt-out...";
        disabled = true;
      } else {
        notSendableButForceDisplay = true;
      }
    } else if (!this.isContactBetweenTextingHours(contact)) {
      if (!this.props.forceDisabledDisplayIfNotSendable) {
        disabledText = "Refreshing ...";
        disabled = true;
      } else {
        notSendableButForceDisplay = true;
      }
    }

    this.state = {
      disabled,
      disabledText,
      notSendableButForceDisplay,
      // this prevents jitter by not showing the optout/skip buttons right after sending
      justSentNew: false,
      questionResponses,
      snackbarError,
      snackbarActionTitle,
      snackbarOnTouchTap,
      optOutMessageText: campaign.organization.optOutMessage,
      messageText: this.getStartingMessageText(),
      optOutDialogOpen: false,
      errorModalOpen: false,
      skipDialogOpen: false,
      currentInteractionStep:
        availableSteps.length > 0
          ? availableSteps[availableSteps.length - 1]
          : null
    };
    this.onEnter = this.onEnter.bind(this);
    this.setDisabled = this.setDisabled.bind(this);
  }

  componentDidMount() {
    const { contact } = this.props;
    if (!this.props.forceDisabledDisplayIfNotSendable) {
      if (contact.optOut) {
        this.skipContact();
      } else if (!this.isContactBetweenTextingHours(contact)) {
        setTimeout(() => {
          this.props.refreshData();
          this.setState({ disabled: false });
        }, 1500);
      }
    }

    const node = this.refs.messageScrollContainer;
    // Does not work without this setTimeout
    setTimeout(() => {
      node.scrollTop = Math.floor(node.scrollHeight);
    }, 0);

    // note: key*down* is necessary to stop propagation of keyup for the textarea element
    document.body.addEventListener("keydown", this.onEnter);
  }

  componentWillUnmount() {
    document.body.removeEventListener("keydown", this.onEnter);
  }

  onEnter(evt) {
    if (evt.keyCode === 13) {
      evt.preventDefault();
      // pressing the Enter key submits
      if (this.state.optOutDialogOpen) {
        this.handleOptOut();
      } else if (this.state.skipDialogOpen) {
        this.handleSkipContact();
        this.handleCloseSkipDialog();
      } else {
        this.handleClickSendMessageButton();
      }
    }
  }

  setDisabled = async (disabled = true) => {
    this.setState({ disabled });
  };

  getAvailableInteractionSteps(questionResponses) {
    const allInteractionSteps = this.props.campaign.interactionSteps;
    const availableSteps = [];

    let step = getTopMostParent(allInteractionSteps);

    while (step) {
      availableSteps.push(step);
      const questionResponseValue = questionResponses[step.id];
      if (questionResponseValue) {
        const matchingAnswerOption = step.question.answerOptions.find(
          answerOption => answerOption.value === questionResponseValue
        );
        if (matchingAnswerOption && matchingAnswerOption.nextInteractionStep) {
          step = interactionStepForId(
            matchingAnswerOption.nextInteractionStep.id,
            allInteractionSteps
          );
        } else {
          step = null;
        }
      } else {
        step = null;
      }
    }

    return availableSteps;
  }

  getInitialQuestionResponses(questionResponseValues) {
    const questionResponses = {};
    questionResponseValues.forEach(questionResponse => {
      questionResponses[questionResponse.interactionStepId] =
        questionResponse.value;
    });

    return questionResponses;
  }
  getMessageTextFromScript(script) {
    const { campaign, contact, texter } = this.props;

    return script
      ? applyScript({
          contact,
          texter,
          script,
          customFields: campaign.customFields
        })
      : null;
  }

  getStartingMessageText() {
    const { contact, campaign } = this.props;
    const { messages } = contact;
    return messages.length > 0
      ? ""
      : this.getMessageTextFromScript(
          getTopMostParent(campaign.interactionSteps).script
        );
  }

  handleCannedResponseChange = cannedResponse => {
    this.setState(
      {
        cannedResponseId: cannedResponse.id
      },
      () => {
        this.handleChangeScript(cannedResponse.text);
      }
    );
  };

  createMessageToContact(text, cannedResponseId) {
    const { texter, assignment, contact } = this.props;

    return {
      contactNumber: contact.cell,
      userId: texter.id,
      text,
      assignmentId: assignment.id,
      cannedResponseId
    };
  }

  goBackToTodos = () => {
    const { campaign } = this.props;
    this.props.router.push(`/app/${campaign.organization.id}/todos`);
  };

  handleSendMessageError = e => {
    if (e.status === 402) {
      this.goBackToTodos();
    } else if (e.status === 400) {
      const newState = {
        snackbarError: e.message
      };

      if (e.message === "Your assignment has changed") {
        newState.snackbarActionTitle = "Back to todos";
        newState.snackbarOnTouchTap = this.goBackToTodos;
        this.setState(newState);
      } else {
        // opt out or send message Error
        this.setState({
          disabled: true,
          disabledText: e.message
        });
        this.skipContact();
      }
    } else {
      console.error(e);
      this.setState({
        snackbarError: "Something went wrong!"
      });
    }
  };

  handleMessageFormSubmit = async ({ messageText }) => {
    try {
      const { contact } = this.props;
      const message = this.createMessageToContact(
        messageText,
        this.state.cannedResponseId
      );
      if (this.state.disabled) {
        return; // stops from multi-send
      }
      this.setState({ disabled: true });
      console.log("sendMessage", contact.id);
      const sendMessageResult = await this.props.mutations.sendMessage(
        message,
        contact.id
      );
      if (sendMessageResult.errors && this.props.campaign.organization.id) {
        this.props.router.push(
          `/app/${this.props.campaign.organization.id}/suspended`
        );
      }

      await this.handleSubmitSurveys();
      this.props.onFinishContact(contact.id);
    } catch (e) {
      this.handleSendMessageError(e);
    }
  };

  handleSubmitSurveys = async () => {
    const { contact } = this.props;

    const deletionIds = [];
    const questionResponseObjects = [];

    const interactionStepIds = Object.keys(this.state.questionResponses);

    const count = interactionStepIds.length;

    for (let i = 0; i < count; i++) {
      const interactionStepId = interactionStepIds[i];
      const value = this.state.questionResponses[interactionStepId];
      if (value) {
        questionResponseObjects.push({
          interactionStepId,
          campaignContactId: contact.id,
          value
        });
      } else {
        deletionIds.push(interactionStepId);
      }
    }
    if (questionResponseObjects.length) {
      await this.props.mutations.updateQuestionResponses(
        questionResponseObjects,
        contact.id
      );
    }
    if (deletionIds.length) {
      await this.props.mutations.deleteQuestionResponses(
        deletionIds,
        contact.id
      );
    }
  };

  handleSkipContact = async () => {
    await this.handleSubmitSurveys();
    await this.handleApplyTag();
    await this.handleEditMessageStatus("closed");
    this.props.onFinishContact();
  };

  handleApplyTag = async () => {
    if (!!this.state.tag && this.state.tag !== NO_TAG.value) {
      await this.props.mutations.addTag(
        [this.props.contact.id],
        [this.state.tag],
        ""
      );
      this.setState({
        tag: undefined,
        skipComment: undefined
      });
    }
  };

  handleEditMessageStatus = async messageStatus => {
    const { contact } = this.props;
    await this.props.mutations.editCampaignContactMessageStatus(
      messageStatus,
      contact.id
    );
  };

  handleOptOut = async () => {
    const optOutMessageText = this.state.optOutMessageText;
    const { contact } = this.props;
    const { assignment } = this.props;
    const message = this.createMessageToContact(optOutMessageText);
    if (this.state.disabled) {
      return; // stops from multi-send
    }
    this.setState({ disabled: true });
    try {
      if (optOutMessageText.length) {
        const sendMessageResult = await this.props.mutations.sendMessage(
          message,
          contact.id
        );
        if (sendMessageResult.errors && this.props.campaign.organization.id) {
          this.props.router.push(
            `/app/${this.props.campaign.organization.id}/suspended`
          );
        }
      }

      const optOut = {
        cell: contact.cell,
        assignmentId: assignment.id
      };

      await this.handleSubmitSurveys();
      const optOutRes = await this.props.mutations.createOptOut(
        optOut,
        contact.id
      );

      if (optOutRes.errors) {
        this.toggleErrorModal();
      } else {
        this.props.onFinishContact(contact.id);
      }
    } catch (e) {
      this.handleSendMessageError(e);
    }
  };

  handleOpenSkipDialog = () => {
    this.setState({ skipDialogOpen: true });
  };

  handleCloseSkipDialog = () => {
    this.setState({ skipDialogOpen: false });
  };

  handleOpenDialog = () => {
    this.setState({ optOutDialogOpen: true });
  };

  toggleErrorModal = () =>
    this.setState(prevState => {
      const errorModalOpen = !prevState.errorModalOpen;
      return { errorModalOpen };
    });

  handleCloseDialog = () => {
    this.setState({ optOutDialogOpen: false });
  };

  handleChangeScript = newScript => {
    const messageText = this.getMessageTextFromScript(newScript);

    this.setState({
      messageText
    });
  };

  handleQuestionResponseChange = ({
    interactionStep,
    questionResponseValue,
    nextScript
  }) => {
    const { questionResponses } = this.state;
    const { interactionSteps } = this.props.campaign;
    questionResponses[interactionStep.id] = questionResponseValue;

    const children = getChildren(interactionStep, interactionSteps);
    for (const childStep of children) {
      if (childStep.id in questionResponses) {
        questionResponses[childStep.id] = null;
      }
    }

    this.setState(
      {
        cannedResponseId: undefined,
        questionResponses
      },
      () => {
        this.handleChangeScript(nextScript);
      }
    );
  };

  handleClickSendMessageButton = () => {
    this.refs.form.submit();
    if (this.props.contact.messageStatus === "needsMessage") {
      this.setState({ justSentNew: true });
    }
  };

  isContactBetweenTextingHours(contact) {
    const { campaign } = this.props;

    let timezoneData = null;

    if (
      contact.location &&
      contact.location.timezone &&
      contact.location.timezone.offset
    ) {
      const { hasDST, offset } = contact.location.timezone;

      timezoneData = { hasDST, offset };
    } else {
      const location = getContactTimezone(
        this.props.campaign,
        contact.location
      );
      if (location) {
        const timezone = location.timezone;
        if (timezone) {
          timezoneData = timezone;
        }
      }
    }

    const {
      textingHoursStart,
      textingHoursEnd,
      textingHoursEnforced
    } = campaign.organization;
    const config = {
      textingHoursStart,
      textingHoursEnd,
      textingHoursEnforced
    };

    if (campaign.overrideOrganizationTextingHours) {
      config.campaignTextingHours = {
        textingHoursStart: campaign.textingHoursStart,
        textingHoursEnd: campaign.textingHoursEnd,
        textingHoursEnforced: campaign.textingHoursEnforced,
        timezone: campaign.timezone
      };
    }

    return isBetweenTextingHours(timezoneData, config);
  }

  skipContact = () => {
    setTimeout(this.props.onFinishContact, 1500);
  };

  bulkSendMessages = async assignmentId => {
    await this.props.mutations.bulkSendMessages(assignmentId);
    this.props.refreshData();
  };

  messageSchema = yup.object({
    messageText: yup
      .string()
      .required("Can't send empty message")
      .max(window.MAX_MESSAGE_LENGTH)
  });

  handleMessageFormChange = ({ messageText }) => {
    const newState = { messageText };
    // Clear out the canned response id if it's set and the message gets
    // cleared completely.
    // TODO: do we want to do something similar for question responses?
    if (this.state.cannedResponseId && !messageText) {
      newState.cannedResponseId = undefined;
    }
    this.setState(newState);
  };

  renderSkipDialog = () => (
    <SkipDialog
      tag={this.state.tag}
      comment={this.state.skipComment}
      open={this.state.skipDialogOpen}
      skipMessageText={this.state.optOutMessageText}
      disabled={this.state.disabled || this.state.notSendableButForceDisplay}
      onSkip={this.handleSkipContact}
      onRequestClose={this.handleCloseSkipDialog}
      onSkipCommentChanged={skipComment => this.setState({ skipComment })}
      onTagChanged={tag => this.setState({ tag })}
    />
  );

  dialogActions = (
    <FlatButton
      label="Close"
      primary
      onClick={() => this.handleCloseDialog()}
    />
  );
  renderErrorModal = () => (
    <Dialog
      title="Oh no! There's been an error."
      open={this.state.errorModalOpen}
      modal
      actions={
        <FlatButton
          label="Close"
          primary
          onClick={() => {
            this.toggleErrorModal();
            this.props.onFinishContact(this.props.contact.id);
          }}
        />
      }
    >
      <span>
        We may not have been able to successfully opt out this number. Please
        contact an administrator in Slack to ensure that opt out is saved to our
        database. Thanks!
      </span>
    </Dialog>
  );

  renderOptOutDialog = () => (
    <OptOutDialog
      open={this.state.optOutDialogOpen}
      optOutMessageText={this.state.optOutMessageText}
      disabled={this.state.disabled || this.state.notSendableButForceDisplay}
      onOptOut={this.handleOptOut}
      onRequestClose={this.handleCloseDialog}
      onOptOutMessageTextChanged={optOutMessageText =>
        this.setState({ optOutMessageText })
      }
    />
  );

  renderMiddleScrollingSection() {
    const { contact } = this.props;
    return <MessageList contact={contact} messages={contact.messages} />;
  }

  renderSurveySection() {
    const { contact } = this.props;
    const { messages } = contact;

    const { questionResponses } = this.state;

    const availableInteractionSteps = this.getAvailableInteractionSteps(
      questionResponses
    );

    return messages.length === 0 ? (
      <Empty
        title={"This is your first message to " + contact.firstName}
        icon={<CreateIcon />}
        hideMobile
      />
    ) : (
      <div>
        <AssignmentTexterSurveys
          contact={contact}
          interactionSteps={availableInteractionSteps}
          onQuestionResponseChange={this.handleQuestionResponseChange}
          currentInteractionStep={this.state.currentInteractionStep}
          questionResponses={questionResponses}
        />
      </div>
    );
  }

  renderNeedsResponseToggleButton(contact) {
    const { messageStatus } = contact;
    let button = null;
    if (messageStatus === "closed") {
      button = (
        <RaisedButton
          onTouchTap={() => this.handleEditMessageStatus("needsResponse")}
          label="Reopen"
          style={inlineStyles.buttonWidth}
        />
      );
    } else if (messageStatus === "needsResponse") {
      button = (
        <RaisedButton
          onTouchTap={this.handleOpenSkipDialog}
          label="Skip Reply"
          style={inlineStyles.buttonWidth}
        />
      );
    }

    return button;
  }

  renderActionToolbar() {
    const {
      contact,
      campaign,
      assignment,
      navigationToolbarChildren,
      onFinishContact
    } = this.props;
    const { justSentNew } = this.state;
    const { messageStatus } = contact;
    const size = document.documentElement.clientWidth;

    if (messageStatus === "needsMessage" || justSentNew) {
      return (
        <div>
          <Toolbar style={inlineStyles.actionToolbarFirst}>
            <ToolbarGroup firstChild>
              <SendButton
                threeClickEnabled={campaign.organization.threeClickEnabled}
                onFinalTouchTap={this.handleClickSendMessageButton}
                disabled={
                  this.state.disabled || this.state.notSendableButForceDisplay
                }
              />
              {window.NOT_IN_USA &&
              window.ALLOW_SEND_ALL &&
              window.BULK_SEND_CHUNK_SIZE ? (
                <BulkSendButton
                  assignment={assignment}
                  onFinishContact={onFinishContact}
                  bulkSendMessages={this.bulkSendMessages}
                  setDisabled={this.setDisabled}
                />
              ) : (
                ""
              )}
            </ToolbarGroup>
            <div className={css(styles.navButtonsWrapper)}>
              {navigationToolbarChildren}
            </div>
          </Toolbar>
        </div>
      );
    } else if (size < 450) {
      // for needsResponse or messaged or convo
      return (
        <div>
          <Toolbar
            className={css(styles.mobile)}
            style={inlineStyles.actionToolbar}
          >
            <ToolbarGroup
              style={inlineStyles.mobileToolBar}
              className={css(styles.lgMobileToolBar)}
              firstChild
            >
              <RaisedButton
                {...dataTest("optOut")}
                secondary
                label="Opt out"
                onTouchTap={this.handleOpenDialog}
                style={inlineStyles.buttonWidth}
              />
              {this.renderNeedsResponseToggleButton(contact)}
            </ToolbarGroup>
            <div className={css(styles.navButtonsWrapper)}>
              {navigationToolbarChildren}
            </div>
          </Toolbar>
        </div>
      );
    } else if (size >= 768) {
      // for needsResponse or messaged
      return (
        <div>
          <Toolbar style={inlineStyles.actionToolbarFirst}>
            <ToolbarGroup firstChild>
              <SendButton
                threeClickEnabled={campaign.organization.threeClickEnabled}
                onFinalTouchTap={this.handleClickSendMessageButton}
                disabled={
                  this.state.disabled || this.state.notSendableButForceDisplay
                }
              />
              {this.renderNeedsResponseToggleButton(contact)}
              <RaisedButton
                {...dataTest("optOut")}
                secondary
                label="Opt out"
                onTouchTap={this.handleOpenDialog}
                style={inlineStyles.buttonWidth}
              />
            </ToolbarGroup>
            <div className={css(styles.navButtonsWrapper)}>
              {navigationToolbarChildren}
            </div>
          </Toolbar>
        </div>
      );
    }
    return "";
  }

  renderTopFixedSection() {
    const { contact } = this.props;
    return (
      <ContactToolbar
        campaign={this.props.campaign}
        assignment={this.props.assignment}
        campaignContact={contact}
        onOptOut={this.handleNavigateNext}
        rightToolbarIcon={
          <IconButton
            onTouchTap={this.props.onExitTexter}
            style={inlineStyles.exitTexterIconButton}
            tooltip="Return Home"
            tooltipPosition="bottom-center"
          >
            <NavigateHomeIcon color="rgb(255,255,255)" />
          </IconButton>
        }
      />
    );
  }

  renderReplyTools() {
    const { campaign, assignment, texter, contact } = this.props;
    const { campaignCannedResponses } = assignment;

    const nonDeletedResponses = campaignCannedResponses.filter(r => !r.deleted);

    const shiftingConfigurationJSON = campaign.shiftingConfiguration;
    const shiftingConfiguration = shiftingConfigurationJSON
      ? JSON.parse(shiftingConfigurationJSON)
      : { enabled: false };

    return (
      <ReplyTools
        campaignCannedResponses={nonDeletedResponses}
        onSelectCannedResponse={this.handleCannedResponseChange}
        shiftingConfiguration={shiftingConfiguration}
        contact={contact}
      />
    );
  }

  renderCorrectSendButton() {
    const { campaign } = this.props;
    const { contact } = this.props;
    if (
      contact.messageStatus === "messaged" ||
      contact.messageStatus === "convo" ||
      contact.messageStatus === "needsResponse"
    ) {
      return (
        <SendButtonArrow
          threeClickEnabled={campaign.organization.threeClickEnabled}
          onFinalTouchTap={this.handleClickSendMessageButton}
          disabled={
            !!(this.state.disabled || this.state.notSendableButForceDisplay)
          }
        />
      );
    }
    return null;
  }

  renderBottomFixedSection() {
    const { optOutDialogOpen, skipDialogOpen } = this.state;
    const { contact } = this.props;
    const { messageStatus } = contact;

    const message =
      optOutDialogOpen || skipDialogOpen ? (
        ""
      ) : (
        <div className={css(styles.messageField)}>
          <GSForm
            ref="form"
            schema={this.messageSchema}
            value={{ messageText: this.state.messageText }}
            onSubmit={this.handleMessageFormSubmit}
            onChange={
              messageStatus === "needsMessage"
                ? ""
                : this.handleMessageFormChange
            }
          >
            <Form.Field
              className={css(styles.textField)}
              name="messageText"
              label="Your message"
              multiLine
              fullWidth
              rowsMax={6}
            />
            {this.renderCorrectSendButton()}
          </GSForm>
        </div>
      );

    return (
      <div>
        {this.renderSurveySection()}
        <div>
          {message}
          {optOutDialogOpen || skipDialogOpen ? "" : this.renderActionToolbar()}
        </div>
        {this.renderSkipDialog()}
        {this.renderOptOutDialog()}
      </div>
    );
  }

  //todo middle scrolling section needs to be 800px and then next to it needs to
  render() {
    const { messageStatus } = this.props.contact;
    const { justSentNew } = this.state;
    const shouldHideReplyTools = !(
      messageStatus === "needsMessage" || justSentNew
    );

    return (
      <div>
        {this.state.errorModalOpen && this.renderErrorModal()}
        {this.state.disabled ? (
          <div className={css(styles.overlay)}>
            <CircularProgress size={0.5} />
            {this.state.disabledText}
          </div>
        ) : (
          ""
        )}
        <div className={css(styles.container)}>
          <div className={css(styles.topFixedSection)}>
            {this.renderTopFixedSection()}
          </div>
          <div className={css(styles.mainSectionContainer)}>
            <div className={css(styles.messageSection)}>
              <div
                {...dataTest("messageList")}
                ref="messageScrollContainer"
                className={css(styles.middleScrollingSection)}
              >
                {this.renderMiddleScrollingSection()}
              </div>
              <div className={css(styles.bottomFixedSection)}>
                {this.renderBottomFixedSection()}
              </div>
            </div>
            {shouldHideReplyTools && (
              <div className={css(styles.responsesSection)}>
                {this.renderReplyTools()}
              </div>
            )}
          </div>
        </div>
        <Snackbar
          style={inlineStyles.snackbar}
          open={!!this.state.snackbarError}
          message={this.state.snackbarError || ""}
          action={this.state.snackbarActionTitle}
          onActionClick={this.state.snackbarOnTouchTap}
        />
      </div>
    );
  }
}

AssignmentTexterContact.propTypes = {
  contact: PropTypes.object,
  campaign: PropTypes.object,
  assignment: PropTypes.object,
  texter: PropTypes.object,
  navigationToolbarChildren: PropTypes.array,
  onFinishContact: PropTypes.func,
  router: PropTypes.object,
  mutations: PropTypes.object,
  refreshData: PropTypes.func,
  onExitTexter: PropTypes.func,
  forceDisabledDisplayIfNotSendable: PropTypes.bool
};

const mapMutationsToProps = () => ({
  createOptOut: (optOut, campaignContactId) => ({
    mutation: gql`
      mutation createOptOut(
        $optOut: OptOutInput!
        $campaignContactId: String!
      ) {
        createOptOut(optOut: $optOut, campaignContactId: $campaignContactId) {
          id
        }
      }
    `,
    variables: {
      optOut,
      campaignContactId
    }
  }),
  editCampaignContactMessageStatus: (messageStatus, campaignContactId) => ({
    mutation: gql`
      mutation editCampaignContactMessageStatus(
        $messageStatus: String!
        $campaignContactId: String!
      ) {
        editCampaignContactMessageStatus(
          messageStatus: $messageStatus
          campaignContactId: $campaignContactId
        ) {
          id
          messageStatus
        }
      }
    `,
    variables: {
      messageStatus,
      campaignContactId
    }
  }),
  deleteQuestionResponses: (interactionStepIds, campaignContactId) => ({
    mutation: gql`
      mutation deleteQuestionResponses(
        $interactionStepIds: [String]
        $campaignContactId: String!
      ) {
        deleteQuestionResponses(
          interactionStepIds: $interactionStepIds
          campaignContactId: $campaignContactId
        ) {
          id
        }
      }
    `,
    variables: {
      interactionStepIds,
      campaignContactId
    }
  }),
  updateQuestionResponses: (questionResponses, campaignContactId) => ({
    mutation: gql`
      mutation updateQuestionResponses(
        $questionResponses: [QuestionResponseInput]
        $campaignContactId: String!
      ) {
        updateQuestionResponses(
          questionResponses: $questionResponses
          campaignContactId: $campaignContactId
        ) {
          id
        }
      }
    `,
    variables: {
      questionResponses,
      campaignContactId
    }
  }),
  sendMessage: (message, campaignContactId) => ({
    mutation: gql`
      mutation sendMessage(
        $message: MessageInput!
        $campaignContactId: String!
      ) {
        sendMessage(message: $message, campaignContactId: $campaignContactId) {
          id
          messageStatus
          messages {
            id
            createdAt
            text
            isFromContact
          }
        }
      }
    `,
    variables: {
      message,
      campaignContactId
    }
  }),
  addTag: (campaignContactIds, tags, comment) => ({
    mutation: gql`
      mutation addTag(
        $campaignContactIds: [String]!
        $tags: [String]!
        $comment: String
      ) {
        addTagsToCampaignContacts(
          campaignContactIds: $campaignContactIds
          tags: $tags
          comment: $comment
        )
      }
    `,
    variables: {
      campaignContactIds,
      tags,
      comment
    }
  })
});

export default loadData(wrapMutations(withRouter(AssignmentTexterContact)), {
  mapMutationsToProps
});
