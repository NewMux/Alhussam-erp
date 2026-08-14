CREATE TABLE `staffAccessInvites` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(160) NOT NULL,
  `email` varchar(320) NOT NULL,
  `customRoleId` int NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `invitedBy` int NOT NULL,
  `invitedAt` timestamp NOT NULL DEFAULT (now()),
  `acceptedByUserId` int,
  `acceptedAt` timestamp,
  CONSTRAINT `staffAccessInvites_id` PRIMARY KEY(`id`),
  CONSTRAINT `staffAccessInvites_email_unique` UNIQUE(`email`)
);
