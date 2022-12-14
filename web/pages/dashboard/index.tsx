import { PublishedElection } from "@vocdoni/sdk";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAccount, useContract, useSigner } from "wagmi";
import { SBT_ABI } from "../../abis/currentABI";
import DiscussionNVote from "../../components/dashboard/Discussion&Vote";
import { overviewData, voteData } from "../../components/dashboard/dummydata";
import Overview from "../../components/dashboards-shared/Overview";
import PageLayout from "../../components/layouts/PageLayout";
import { SocialsFooter } from "../../components/SocialsFooter";
import { useOrbis } from "../../context/orbis";
import { useVocdoni } from "../../context/vocdoni";
export default function Dashboard() {
  const router = useRouter();
  const { isConnecting, address } = useAccount();
  const { data: signer } = useSigner();
  const contract = useContract({
    address: process.env.NEXT_PUBLIC_SBT_ADDR,
    abi: SBT_ABI,
    signerOrProvider: signer,
  });

  const { client, proposalData, setProposalData } = useVocdoni();

  useEffect(() => {
    async function getProposalIDs() {
      if (client && contract && signer && setProposalData) {
        const proposal_data = await contract.fetchProposalIds();

        let temp_proposals: PublishedElection[] = [];
        for (let i = 0; i < proposal_data.length; i++) {
          if (proposal_data[i].isActive === false) continue;
          const id = proposal_data[i].proposalId;
          const proposal = await client.fetchElection(id);
          temp_proposals.push(proposal);
        }
        setProposalData(temp_proposals);
      }
    }

    getProposalIDs();
  }, [client, setProposalData, proposalData, contract, signer]);

  interface IPosts {
    data: [];
    error: string;
    status: number;
  }
  const [user, setUser] = useState();
  const [posts, setPosts] = useState({} as IPosts);
  const { orbis } = useOrbis();

  const groupId = process.env.NEXT_PUBLIC_ORBIS_GROUP_ID;

  useEffect(() => {
    const getPosts = async () => {
      if (user && groupId) {
        const posts = await orbis.getPosts({
          context: groupId,
        });
        console.log({ posts });
        return posts;
      } else {
        console.log("need to connect to orbis");
        return [];
      }
    };

    getPosts().then((posts) => {
      setPosts(posts);
    });
  }, [groupId, orbis, user]);
  useEffect(() => {
    (async () => {
      if (!orbis) return;
      const connectedRes = await orbis.isConnected();
      if (connectedRes.status === 200) {
        setUser(connectedRes.did);
      } else {
        const res = await orbis.connect();
        if (res.status == 200) {
          setUser(res.did);
        } else {
          console.log("Error connecting to Orbis: ", res);
        }
      }
    })();
  }, [orbis]);

  const { bal } = router.query;
  useEffect(() => {
    (async () => {
      if (contract && address && signer && router) {
        const scopedTokenId = await contract
          .ownerToTokenId(address)
          .then(parseInt);
        if (!scopedTokenId && router.query["minted"] !== "success")
          router.push("/join");
      }
    })();
  }, [contract, address, signer, router]);

  function onDiscussVote() {
    document.querySelector("#discussion")?.scrollIntoView();
  }
  function onManageSbt() {
    router.push("/dashboard/manage-membership");
  }
  function onProposal(proposalId: number) {
    router.push({ pathname: `/dashboard/governance/${proposalId}` });
  }

  return (
    <>
      {!address || isConnecting ? (
        <PageLayout containerClassName="bg-custom-blue bg-cover min-h-screen">
          <div className="text-center mt-20 min-w-full">
            <h1 className="font-bold text-custom-purple text-3xl leading-tight">
              Please Sign In To View Dashboard
            </h1>
          </div>
        </PageLayout>
      ) : (
        <PageLayout containerClassName="bg-custom-blue bg-cover min-h-screen">
          <div className="text-center my-5 md:my-10 w-full">
            <Overview
              overviewData={overviewData}
              onClick1={onDiscussVote}
              onClick2={onManageSbt}
            />

            <DiscussionNVote
              discussionData={posts}
              proposalData={proposalData}
              voteData={voteData}
              onProposal={onProposal}
            />
            <SocialsFooter />
          </div>
        </PageLayout>
      )}
    </>
  );
}
