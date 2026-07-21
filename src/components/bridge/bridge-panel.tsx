"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepositEth } from "./deposit-eth";
import { DepositErc20 } from "./deposit-erc20";
import { WithdrawEth } from "./withdraw-eth";
import { WithdrawErc20 } from "./withdraw-erc20";
import { DepositTracker } from "./deposit-tracker";
import { WithdrawalTracker } from "./withdrawal-tracker";

export function BridgePanel() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle>Bridge</CardTitle>
            <CardDescription>
              Move ETH or ERC-20 tokens between Sepolia (L1) and Giwa Sepolia (L2).
            </CardDescription>
          </div>
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="deposit" className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="deposit">Deposit (L1 → L2)</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw (L2 → L1)</TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              <Tabs defaultValue="eth" className="gap-4">
                <TabsList>
                  <TabsTrigger value="eth">ETH</TabsTrigger>
                  <TabsTrigger value="erc20">ERC-20</TabsTrigger>
                </TabsList>
                <TabsContent value="eth">
                  <DepositEth />
                </TabsContent>
                <TabsContent value="erc20">
                  <DepositErc20 />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="withdraw">
              <Tabs defaultValue="eth" className="gap-4">
                <TabsList>
                  <TabsTrigger value="eth">ETH</TabsTrigger>
                  <TabsTrigger value="erc20">ERC-20</TabsTrigger>
                </TabsList>
                <TabsContent value="eth">
                  <WithdrawEth />
                </TabsContent>
                <TabsContent value="erc20">
                  <WithdrawErc20 />
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your History</CardTitle>
          <CardDescription>
            L1↔L2 activity for the connected wallet, queried directly from RPC.
            Withdrawals: prove ~2h after initiate, finalize after a ~7 day
            challenge period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="deposits" className="gap-4">
            <TabsList>
              <TabsTrigger value="deposits">Deposits</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            </TabsList>
            <TabsContent value="deposits">
              <DepositTracker />
            </TabsContent>
            <TabsContent value="withdrawals">
              <WithdrawalTracker />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
