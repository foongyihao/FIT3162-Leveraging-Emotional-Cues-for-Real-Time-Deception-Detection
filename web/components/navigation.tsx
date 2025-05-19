"use client"

import * as React from "react"
import Link from "next/link"
import {usePathname} from "next/navigation"
import {cn} from "@/lib/utils"
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import {ModeToggle} from "@/components/mode-toggle"

export default function Navigation() {
	const pathname = usePathname()

	return (
		<div className="border-b">
			<div className="flex h-16 items-center px-4 container mx-auto">
				<NavigationMenu>
					<NavigationMenuList>
						<NavigationMenuItem>
							<Link href="/" legacyBehavior passHref>
								<NavigationMenuLink className={cn(
									navigationMenuTriggerStyle(),
									pathname === "/" && "bg-accent"
								)}>
									Home
								</NavigationMenuLink>
							</Link>
						</NavigationMenuItem>
						<NavigationMenuItem>
							<Link href="/model" legacyBehavior passHref>
								<NavigationMenuLink className={cn(
									navigationMenuTriggerStyle(),
									pathname === "/model" && "bg-accent"
								)}>
									Model
								</NavigationMenuLink>
							</Link>
						</NavigationMenuItem>
						<NavigationMenuItem>
							<Link href="/dataset" legacyBehavior passHref>
								<NavigationMenuLink className={cn(
									navigationMenuTriggerStyle(),
									pathname === "/dataset" && "bg-accent"
								)}>
									Dataset Summary
								</NavigationMenuLink>
							</Link>
						</NavigationMenuItem>
						<NavigationMenuItem>
							<Link href="/about" legacyBehavior passHref>
								<NavigationMenuLink className={cn(
									navigationMenuTriggerStyle(),
									pathname === "/about" && "bg-accent"
								)}>
									About
								</NavigationMenuLink>
							</Link>
						</NavigationMenuItem>
						<NavigationMenuItem>
							<Link href="/manual" legacyBehavior passHref>
								<NavigationMenuLink className={cn(
									navigationMenuTriggerStyle(),
									pathname === "/manual" && "bg-accent"
								)}>
									User Manual
								</NavigationMenuLink>
							</Link>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>
				<div className="ml-auto">
					<ModeToggle/>
				</div>
			</div>
		</div>
	)
}