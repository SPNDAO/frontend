import { useRouter } from "next/router";
import { useState } from "react";
import { AiFillCloseCircle } from "react-icons/ai";
import DatePicker from "react-tailwindcss-datepicker";
import BaseModal from "../../../components/BaseModal";
import Button, { ButtonStyle } from "../../../components/Button";
import BackButton from "../../../components/dashboards-shared/BackButton";
import PageLayout from "../../../components/layouts/PageLayout";
import Spinner from "../../../components/Spinner";
import { useEffect, useRef } from "react";
import { useContractRead, useContractWrite, useSigner } from "wagmi";
import { ADMIN_ABI, SBT_ABI } from "../../../abis/currentABI";
import { useVocdoni } from "../../../context/vocdoni";
import { AccountData, Election, PlainCensus } from "@vocdoni/sdk";

enum CreateProposalState {
  Step1BasicInfo = "basic_info",
  Step2VoteOptions = "vote_options",
  loading = "loading",
}

export default function CreateProposal() {
  const router = useRouter();
  const { client } = useVocdoni();

  const { data: sbtHolders } = useContractRead({
    address: process.env.NEXT_PUBLIC_SBT_ADDR,
    abi: SBT_ABI,
    functionName: "fetchHolders",
  });

  const { write, isSuccess } = useContractWrite({
    mode: "recklesslyUnprepared",
    address: process.env.NEXT_PUBLIC_ADMIN_ADDR,
    abi: ADMIN_ABI,
    functionName: "addProposal",
  });

  const [pageState, setPageState] = useState(
    CreateProposalState.Step1BasicInfo
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discussion, setDiscussion] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeWindow, setTimeWindow] = useState({
    startDate: "",
    endDate: "",
  });
  const [voteOptions, setVoteOptions] = useState<[string, string][]>([]);

  const isValidStep1 = title && description;
  const isValidStep2 =
    timeWindow.startDate &&
    timeWindow.endDate &&
    voteOptions?.length > 1 &&
    voteOptions.every((opt) => !!opt[1]);

  function onStep1Continue() {
    if (!isValidStep1) return;

    console.log("onStep1Continue");
    setPageState(CreateProposalState.Step2VoteOptions);
  }

  async function onStep2Continue() {
    if (!isValidStep1) return;

    setPageState(CreateProposalState.loading);

    const data = {
      title,
      description,
      discussion,
      startDate: timeWindow.startDate,
      endDate: timeWindow.endDate,
      voteOptions: voteOptions.map((opt) => opt[1]),
    };

    // 3 steps to vocdoni proposal creation ---
    console.log("step 1");
    // step 1: create a new census + add contract sbt holders to it
    const census = new PlainCensus();
    for (const holder of sbtHolders as string[]) {
      census.add(holder);
    }
    console.log("step 2");
    // step 2: create a new election
    const election = Election.from({
      title: `${data.title}`,
      description: `${data.description}`,
      header: `${data.discussion}`,
      startDate: data.startDate,
      endDate: data.endDate,
      census,
      streamUri: "https://vocdoni.io",
    });
    console.log("step 3");
    // step 3: create a new proposal
    election.addQuestion(`${data.title}`, `${data.description}`, [
      {
        title: "Yes",
        value: 0,
      },
      {
        title: "No",
        value: 1,
      },
    ]);
    console.log("step 4");
    // step 4: publish the proposal
    const proposalID = await client.createElection(election);
    console.log({ proposalID });
    write!({ recklesslySetUnpreparedArgs: [proposalID] });
  }

  useEffect(() => {
    if (isSuccess) {
      setPageState(CreateProposalState.loading);
      router.push("/admin-dashboard/proposal-management");
    }
  }, [isSuccess, router]);

  function onSelectTimeWindow() {
    setShowDatePicker(true);
  }

  function onAddOption() {
    setVoteOptions([...voteOptions, [(voteOptions.length + 1).toString(), ""]]);
  }

  function onRemoveOption(index: number) {
    const options = [
      ...voteOptions.slice(0, index),
      ...(voteOptions.length - 1 >= index
        ? voteOptions.slice(index + 1, voteOptions.length)
        : []),
    ];

    const fixedIndexOpts = options.map((opt, index) => {
      return [(index + 1).toString(), opt[1]] as [string, string];
    });

    setVoteOptions(fixedIndexOpts);
  }

  function updateVoteOptionText(text: string, index: number) {
    console.log({ text });
    const voteOption = voteOptions[index];
    voteOption[1] = text;

    setVoteOptions([
      ...voteOptions.slice(0, index),
      voteOption,
      ...(voteOptions.length - 1 >= index
        ? voteOptions.slice(index + 1, voteOptions.length)
        : []),
    ]);
  }

  function onPickerClick() {}

  return (
    <PageLayout
      isAdmin
      hideHeaderMargin
      containerClassName="bg-custom-blue min-h-screen overflow-hidden px-2 sm:px-4 sm:px-8 md:px-20 relative"
    >
      {/*this is just here for setting up vocdoni-ui */}
      <div className="text-center my-5 md:my-10 w-full">
        <div className="w-stretch m-5 md:mx-28 md:my-12 h-fit py-6 px-4 md:p-10 hero">
          <div className="flex justify-between">
            <BackButton backRoute="/admin-dashboard" />
          </div>

          {pageState === CreateProposalState.Step1BasicInfo && (
            <div className="grid grid-cols-3 mt-8 mb-16">
              <div className="col-span-2 mr-8">
                <div className="flex flex-col text-left mt-4">
                  Title
                  <input
                    className="mt-2"
                    type="text"
                    placeholder="Add proposal title here"
                    name="title"
                    value={title}
                    onChange={(e) => {
                      console.log(e.target.value)
                      setTitle(e.target.value);
                    }}
                  />
                </div>
                <div className="flex flex-col text-left mt-4">
                  Description
                  <textarea
                    className="mt-2 min-h-[10rem]"
                    placeholder={"Describe the proposal in details"}
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="flex flex-col text-left mt-4">
                  Discussion
                  <input
                    className="mt-2"
                    type={"text"}
                    placeholder={"https://(Link the discussion here)"}
                    name="discussion"
                    value={discussion}
                    onChange={(e) => setDiscussion(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-span-1 ml-8">
                <Button onClick={onStep1Continue} disabled={!isValidStep1}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {pageState === CreateProposalState.Step2VoteOptions && (
            <>
              <BaseModal
                open={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                title="Select start/end date"
                footerActions={[
                  {
                    type: "cancel",
                    action: () => {
                      setTimeWindow({ startDate: "", endDate: "" });
                      setShowDatePicker(false);
                    },
                  },
                  { type: "confirm", action: () => setShowDatePicker(false) },
                ]}
              >
                <DatePicker
                  value={timeWindow}
                  // @ts-ignore
                  onChange={(value: typeof timeWindow) => {
                    setShowDatePicker(false);
                    setTimeWindow(value);
                  }}
                />
              </BaseModal>

              <div className="grid grid-cols-3 mt-8 mb-16">
                <div className="col-span-2 mr-8">
                  <div className="flex flex-col items-start">
                    <span className="text-2xl mb-2">{title}</span>

                    <span className="bg-custom-purple text-white rounded-full text-sm px-2 py-1">
                      Overview
                    </span>

                    <span className="text-custom-gray text-sm my-8">
                      {description}
                    </span>
                  </div>

                  <div className="flex flex-col items-start">
                    Cast your vote
                    {voteOptions?.map(
                      (opt: [string, string], index: number) => {
                        return (
                          <>
                            <div className="w-full relative" key={opt[0]}>
                              <button
                                className="opacity-100 hover:opacity-100 absolute text-custom-gray -right-2 top-0"
                                onClick={() => onRemoveOption(index)}
                              >
                                <AiFillCloseCircle size={20} />
                              </button>
                            </div>

                            <input
                              type="text"
                              className="mt-2 w-full text-center py-2 border-2 border-gray px-4 rounded-lg"
                              placeholder={"Option" + opt[0]}
                              value={opt[1]}
                              onChange={(e) =>
                                updateVoteOptionText(e.target.value, index)
                              }
                            />
                          </>
                        );
                      }
                    )}
                    <button
                      className="w-full text-custom-purple mt-4"
                      onClick={onAddOption}
                    >
                      Add another option
                    </button>
                  </div>
                </div>

                <div className="col-span-1 ml-8">
                  <Button
                    addClassName="mb-2"
                    onClick={onSelectTimeWindow}
                    buttonStyle={ButtonStyle.Outline}
                  >
                    {timeWindow.startDate || timeWindow.endDate ? (
                      <input
                        value={
                          !timeWindow?.startDate || !timeWindow?.endDate
                            ? ""
                            : `${timeWindow?.startDate} - ${timeWindow?.endDate}`
                        }
                      />
                    ) : (
                      "Select time window"
                    )}
                  </Button>

                  <Button onClick={onStep2Continue} disabled={!isValidStep2}>
                    Publish
                  </Button>
                </div>
              </div>
            </>
          )}

          {pageState === CreateProposalState.loading && (
            <div className="flex justify-center items-center h-full">
              <Spinner />
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
